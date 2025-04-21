// src/chatHandler.ts
import { openai } from "./openaiClient";
import { searchZendeskAPI, getZendeskArticle, ZendeskArticle } from "./zendesk";

/**
 * 질문에서 "~에 관한" 패턴 앞글자만 뽑아 옵니다.
 */
function getSearchTerm(userQuestion: string): string {
  const m = userQuestion.match(/(.+?)에 관한/);
  return m ? m[1].trim() : userQuestion.trim();
}

/**
 * 질문이 모호한지 확인합니다.
 * (예: '교체 방법'만 있고 장비명이 없을 때)
 */
function isAmbiguous(userQuestion: string): boolean {
  const core = getSearchTerm(userQuestion);
  return /(교체|방법|절차)/.test(userQuestion) && core === userQuestion;
}

/**
 * 질문에서 장비명을 추출해 필터값으로 변환합니다.
 * 예: "FL 게이지" → "FLGauge"
 */
function getEquipmentFilter(userQuestion: string): string | undefined {
  const m = userQuestion.match(/([A-Za-z]+)\s*게이지/);
  if (m) return `${m[1]}Gauge`;
  return undefined;
}

export async function chatWithZendesk(userQuestion: string) {
  // 1) 모호한 질문 명확화
  if (isAmbiguous(userQuestion)) {
    return "어떤 장비에 대한 문제인지 알려주시면 더 정확한 답변을 드릴 수 있습니다.";
  }

  // 2) 시스템 제약: 무조건 API만 사용
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: [
          "당신은 Hanla IMS의 내부 고객지원 어시스턴트입니다.",
          "절대로 자체 지식으로 답하지 말고, 항상 Zendesk 헬프센터 API를 호출해야 합니다.",
          "API 결과에 없는 정보는 절대로 언급하지 마세요."
        ].join(" ")
      },
      { role: "user", content: userQuestion }
    ]
  });

  // 3) 한글 키워드를 영어로 번역
  const kor = getSearchTerm(userQuestion);
  const trans = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "아래 한국어 단어를, Zendesk Help Center 검색에 가장 적합한 영어 단어/문구로 번역하세요."
      },
      { role: "user", content: kor }
    ]
  });
  const eng = trans.choices[0].message.content!.trim();

  // 4) 검색 호출 (장비 필터 적용)
  const equipment = getEquipmentFilter(userQuestion);
  const queryWithEquip = equipment ? `${equipment} ${eng}` : eng;
  const allResults = await searchZendeskAPI(queryWithEquip, 100);
  if (allResults.length === 0) {
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // 5) 페이징 처리
  const limit = 10;
  const page = 1;
  const results = allResults.slice((page - 1) * limit, page * limit);
  let footer = "";
  if (allResults.length > limit) {
    footer = `\n총 ${allResults.length}건 중 일부만 표시됩니다. 더 보려면 '추가로 알려줘'라고 입력하세요.`;
  }

  // 6-1) 특정 용어 포함 요청
  if (/(단어|용어|포함)/.test(userQuestion)) {
    const matching: ZendeskArticle[] = [];
    for (const a of results) {
      const article = await getZendeskArticle(a.id);
      if (article.body_text.toLowerCase().includes(eng.toLowerCase())) {
        matching.push(article);
      }
      if (matching.length >= 3) break;
    }
    if (matching.length === 0) {
      return `죄송합니다. "${kor}"에 해당하는 내용이 포함된 문서를 찾지 못했습니다.`;
    }
    const combined = matching.map(a => a.body_text).join("\n\n");
    const summary = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `다음은 헬프센터 문서에서 "${eng}" 용어가 포함된 부분입니다. 2~3문장으로 요약해 주세요.`
        },
        { role: "user", content: combined }
      ]
    });
    return `**"${kor}"(${eng}) 관련 문서 요약**\n\n${summary.choices[0].message.content}${footer}`;
  }

  // 6-2) 교체/방법/절차 질문
  if (/(교체|방법|절차)/.test(userQuestion)) {
    const article = await getZendeskArticle(results[0].id);
    const summary = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "다음은 헬프센터 문서 본문입니다. '1, 2, 3…' 단계별 절차로 요약해 주세요."
        },
        { role: "user", content: article.body_text }
      ]
    });
    return `**${article.title} 교체 절차 요약**\n\n${summary.choices[0].message.content}${footer}`;
  }

  // 6-3) 문서/내용 요청
  if (/(문서|내용)/.test(userQuestion)) {
    const article = await getZendeskArticle(results[0].id);
    return `**${article.title}**\n\n${article.body_text}${footer}`;
  }

  // 6-4) 일반 질문 → 제목 + URL 리스트
  const list = results
    .map((a, i) => `${i + 1}. ${a.title}\n   🔗 ${a.url}`)
    .join("\n");
  return `${list}${footer}`;
}
