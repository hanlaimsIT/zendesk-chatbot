// src/chatHandler.ts
import { openai } from "./openaiClient";
import { searchZendeskAPI, getZendeskArticle } from "./zendesk";

/**
 * 한글 질문에서 검색 키워드를 추출합니다. "~에 관한" 패턴이 없으면 전체 질문을 반환합니다.
 */
function getSearchTerm(userQuestion: string): string {
    // “X 교체 방법” → X
    let m = userQuestion.match(/(.+?)\s+교체\s*방법/);
    if (m) return m[1].trim();
  
    // “X에 관한” → X
    m = userQuestion.match(/(.+?)에 관한/);
    if (m) return m[1].trim();
  
    // fallback: 전체 질문
    return userQuestion.trim();
  }
export async function chatWithZendesk(userQuestion: string) {
  // 1) 한글 키워드 추출
  const kor = getSearchTerm(userQuestion);

  // 2) 한글 키워드를 영단어로 번역
  const trans = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
        { role: "system", content:
            "아래 한국어 단어를, Zendesk Help Center 검색에 가장 적합한 영어 단어/문구로 번역하세요." },
        { role: "user", content: kor }
      ]
    });
  const eng = trans.choices[0].message.content!.trim();

  // 3) 번역된 키워드로 검색
  const results = await searchZendeskAPI(eng, 5);
  if (results.length === 0) {
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // 4) "교체"나 "방법","절차" 질문일 경우, 첫 문서 본문을 가져와 단계별 요약
  if (/(교체|방법|절차)/.test(userQuestion)) {
    const top = results[0];
    const article = await getZendeskArticle(top.id);

    const summary = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "다음은 헬프 센터 문서 본문입니다. '1, 2, 3…' 형식의 단계별 절차로 요약해 주세요." },
        { role: "user", content: article.body_text }
      ]
    });

    return `**${article.title} 교체 절차 요약**\n\n${summary.choices[0].message.content}`;
  }

  // 5) 일반 질문엔 제목 + URL 리스트 반환
  return results
    .map((a, i) => `${i + 1}. ${a.title}\n   🔗 ${a.url}`)
    .join("\n");
}
