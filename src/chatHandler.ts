// src/chatHandler.ts
import { openai, zendeskFunctions } from "./openaiClient";
import { searchZendeskAPI, getZendeskArticle, ZendeskArticle } from "./zendesk";

/** 질문에서 "~에 관한" 패턴 앞글자만 뽑아 옵니다. */
function getSearchTerm(userQuestion: string): string {
  const m = userQuestion.match(/(.+?)에 관한/);
  return m ? m[1].trim() : userQuestion.trim();
}

export async function chatWithZendesk(userQuestion: string) {
  // ──────────────────────────────────────────────────────────
  // 1) Initial call: 무조건 API만 쓰도록 시스템 메시지 강제
  // ──────────────────────────────────────────────────────────
  const init = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: [
          "당신은 Hanla IMS의 내부 고객지원 어시스턴트입니다.",
          "절대로 자체 지식으로 답하지 말고, 항상 Zendesk 헬프센터 API(searchZendesk)를 호출해야 합니다.",
          "API 결과에 없는 정보는 절대로 언급하지 마세요."
        ].join(" ")
      },
      { role: "user", content: userQuestion }
    ],
    functions: zendeskFunctions as any,
    function_call: "auto"
  });

  // ──────────────────────────────────────────────────────────
  // 2) 모델이 제안한 함수 호출에서 query 꺼내기
  // ──────────────────────────────────────────────────────────
  const msg = init.choices[0].message;
  let eng: string;
  if (msg.function_call) {
    const args = JSON.parse(msg.function_call.arguments!);
    eng = args.query;
  } else {
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
    eng = trans.choices[0].message.content!.trim();
  }

  // ──────────────────────────────────────────────────────────
  // 3) 검색 함수(searchZendeskAPI) 실제 호출
  // ──────────────────────────────────────────────────────────
  const kor = getSearchTerm(userQuestion);
  const results = await searchZendeskAPI(eng, 10);
  if (results.length === 0) {
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // ──────────────────────────────────────────────────────────
  // 3.5) 특정 용어 포함 요청 처리
  // ──────────────────────────────────────────────────────────
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
          content: `다음은 Zendesk 헬프 센터 문서에서 "${eng}" 용어가 포함된 부분입니다. 2~3문장으로 요약해 주세요.`
        },
        { role: "user", content: combined }
      ]
    });
    return `**"${kor}"(${eng}) 관련 문서 요약**\n\n${summary.choices[0].message.content}`;
  }

  // ──────────────────────────────────────────────────────────
  // 4) 질문 유형별 분기 처리
  // ──────────────────────────────────────────────────────────
  // 4-1) 교체/방법/절차 질문 → 첫 문서 본문을 단계별 요약
  if (/(교체|방법|절차)/.test(userQuestion)) {
    const article = await getZendeskArticle(results[0].id);
    const summary = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "다음은 헬프 센터 문서 본문입니다. '1, 2, 3…' 형식의 단계별 절차로 요약해 주세요."
        },
        { role: "user", content: article.body_text }
      ]
    });
    return `**${article.title} 교체 절차 요약**\n\n${summary.choices[0].message.content}`;
  }

  // 4-2) 문서/내용 요청 → 전체 본문 반환
  if (/(문서|내용)/.test(userQuestion)) {
    const article = await getZendeskArticle(results[0].id);
    return `**${article.title}**\n\n${article.body_text}`;
  }

  // 4-3) 그 외 → 제목 + URL 리스트
  return results
    .map((a, i) => `${i + 1}. ${a.title}\n   🔗 ${a.url}`)
    .join("\n");
}