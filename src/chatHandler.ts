// src/chatHandler.ts
import { openai } from "./openaiClient";
import { searchZendeskAPI, getZendeskArticle, ZendeskArticle } from "./zendesk";

/** “X에 관한” 패턴 앞부분만 잡아옵니다. */
function getSearchTerm(q: string): string {
  const m = q.match(/(.+?)에 관한/);
  return m ? m[1].trim() : q.trim();
}

/** 순수 영문 쿼리인지 확인합니다. */
function isEnglishOnly(q: string): boolean {
  // 한글이 하나라도 있으면 false
  return !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
}

/** “FL 게이지” → “FLGauge” 같은 필터키 생성 */
function getEquipmentFilter(q: string): string | undefined {
  const m = q.match(/([A-Za-z]+)\s*게이지/);
  return m ? `${m[1]}Gauge` : undefined;
}

export async function chatWithZendesk(userQuestion: string) {
  // 1) 번역/함수 호출 없이 영문 쿼리는 그대로 사용
  let eng: string;
  if (isEnglishOnly(userQuestion)) {
    eng = userQuestion.trim();
  } else {
    // 한글 키워드 추출 & 번역
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

  // 2) API 검색 (장비 필터 적용, 최대 100건)
  const equipment = getEquipmentFilter(userQuestion);
  const queryWithEquip = equipment ? `${equipment} ${eng}` : eng;
  const allResults = await searchZendeskAPI(queryWithEquip, 100);
  if (allResults.length === 0) {
    const kor = isEnglishOnly(userQuestion)
      ? userQuestion
      : getSearchTerm(userQuestion);
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // 3) 페이징 (한 번에 10건)
  const limit = 10;
  const pageResults = allResults.slice(0, limit);
  const footer =
    allResults.length > limit
      ? `\n\n총 ${allResults.length}건 중 일부만 표시됩니다. 더 보려면 '추가로 알려줘'라고 입력하세요.`
      : "";

  // 4) 공통 헤더
  const header = `“${eng}”로 검색한 최상위 ${pageResults.length}개 문서입니다:\n\n`;

  // 5) “설명” 요청이라면 첫 문서 본문 2~3문장 요약
  if (/설명/.test(userQuestion) || isEnglishOnly(userQuestion) && /explain|describe/i.test(userQuestion)) {
    const art = await getZendeskArticle(pageResults[0].id);
    const summ = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "아래 헬프센터 문서 본문을 읽고, 2~3문장으로 요약해서 설명해 주세요."
        },
        { role: "user", content: art.body_text }
      ]
    });
    return (
      header +
      `1. **${art.title}**\n\n` +
      summ.choices[0].message.content +
      footer
    );
  }

  // 6) 그 외: 헬프센터 순서 그대로 제목 + URL 리스트
  const list = pageResults
    .map((r, i) => {
      // 원본 헬프센터에는 [코드] Title 형식이라면 그대로 넣으셔도 좋습니다.
      return `${i + 1}. ${r.title}\n   🔗 ${r.url}`;
    })
    .join("\n\n");

  return header + list + footer;
}