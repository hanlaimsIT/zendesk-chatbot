// src/chatHandler.ts
import { openai } from "./openaiClient";
import { searchZendeskAPI, getZendeskArticle, ZendeskArticle } from "./zendesk";

/** “X에 관한” 패턴 앞부분만 잡아옵니다. */
function getSearchTerm(q: string): string {
  const m = q.match(/(.+?)에 관한/);
  return m ? m[1].trim() : q.trim();
}

/** “교체/방법/절차”만 있고 장비명이 빠졌으면 모호한 질문으로 간주 */
function isAmbiguous(q: string): boolean {
  const core = getSearchTerm(q);
  return /(교체|방법|절차)/.test(q) && core === q;
}

/** “FL 게이지” → “FLGauge” 같은 필터 키 생성 */
function getEquipmentFilter(q: string): string | undefined {
  const m = q.match(/([A-Za-z]+)\s*게이지/);
  return m ? `${m[1]}Gauge` : undefined;
}

export async function chatWithZendesk(userQuestion: string) {
  // 1) 모호한 질문일 때
  if (isAmbiguous(userQuestion)) {
    return "어떤 장비에 대한 문제인지 알려주시면 더 정확한 답변을 드릴 수 있습니다.";
  }

  // 2) 한글 키워드 추출 & 번역
  const kor = getSearchTerm(userQuestion);
  const trans = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content:
          "아래 한국어 단어를 Zendesk Help Center 검색에 가장 적합한 영어 단어/문구로 번역하세요." },
      { role: "user", content: kor }
    ]
  });
  const eng = trans.choices[0].message.content!.trim();

  // 3) API 검색 (필터 + 최대 100건)
  const equipment = getEquipmentFilter(userQuestion);
  const queryWithEquip = equipment ? `${equipment} ${eng}` : eng;
  const allResults = await searchZendeskAPI(queryWithEquip, 100);
  if (allResults.length === 0) {
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // 4) 페이징(한 번에 10건)
  const limit = 10;
  const pageResults = allResults.slice(0, limit);
  const footer =
    allResults.length > limit
      ? `\n\n총 ${allResults.length}건 중 일부만 표시됩니다. 더 보려면 '추가로 알려줘'라고 입력하세요.`
      : "";

  // 5) 공통 헤더
  const header = 
    `"${kor}"과(와) 관련된 문서를 검색한 결과, ` +
    `**${kor}(${eng})**에 직접 언급된 문서는 없지만, 다음과 같은 문서들이 일부 포함되어 있습니다:\n\n`;

  // 6) 질문 유형별 분기

  // 6-1) “설명” 요청 → 첫 문서 본문 2~3문장 요약
  if (/설명/.test(userQuestion)) {
    const art = await getZendeskArticle(pageResults[0].id);
    const summ = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content:
            "아래 헬프센터 문서 본문을 읽고, 2~3문장으로 요약해서 설명해 주세요." },
        { role: "user", content: art.body_text }
      ]
    });
    return `${header}**${art.title} 설명**\n\n${summ.choices[0].message.content}${footer}`;
  }

  // 6-2) “단어/용어/포함” 요청 → 본문 중 해당 단어가 포함된 문단만 뽑아서 요약
  if (/(단어|용어|포함)/.test(userQuestion)) {
    const matched: ZendeskArticle[] = [];
    for (const r of pageResults) {
      const art = await getZendeskArticle(r.id);
      if (art.body_text.toLowerCase().includes(eng.toLowerCase())) {
        matched.push(art);
      }
      if (matched.length >= 3) break;
    }
    if (matched.length === 0) {
      return `죄송합니다. "${kor}"(${eng})이(가) 포함된 문서를 찾지 못했습니다.`;
    }
    const combined = matched.map(a => a.body_text).join("\n\n");
    const summ = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content:
            `아래 문장에서 "${eng}" 용어가 등장하는 부분을 2~3문장으로 요약해 주세요.` },
        { role: "user", content: combined }
      ]
    });
    return `${header}**"${kor}"(${eng}) 관련 요약**\n\n${summ.choices[0].message.content}${footer}`;
  }

  // 6-3) 교체/방법/절차 → 단계별 절차 요약
  if (/(교체|방법|절차)/.test(userQuestion)) {
    const art = await getZendeskArticle(pageResults[0].id);
    const summ = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content:
            "아래 문서 본문을 읽고, ‘1, 2, 3…’ 형식으로 절차만 단계별로 요약해 주세요." },
        { role: "user", content: art.body_text }
      ]
    });
    return `${header}**${art.title} 절차 요약**\n\n${summ.choices[0].message.content}${footer}`;
  }

  // 6-4) 문서/내용 요청 → 전체 본문 그대로
  if (/(문서|내용)/.test(userQuestion)) {
    const art = await getZendeskArticle(pageResults[0].id);
    return `${header}**${art.title}**\n\n${art.body_text}${footer}`;
  }

  // 6-5) 그 외 → 제목만 리스트업
  const list = pageResults
    .map((r, i) => `${i+1}. ${r.title}`)
    .join("\n");
  return `${header}${list}${footer}`;
}
