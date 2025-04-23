// src/chatHandler.ts
import fetch from 'node-fetch';
import { openai } from './openaiClient';
import { ZendeskArticle } from './zendesk';

const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

async function searchZendeskAPI(
  query: string,
  limit: number
): Promise<ZendeskArticle[]> {
  const url = `${BASE_URL}/api/proxy-search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Proxy search failed: ${res.status} ${err}`);
  }
  const { results } = await res.json();
  return (results as ZendeskArticle[]).slice(0, limit);
}

async function getZendeskArticle(
  articleId: number
): Promise<ZendeskArticle> {
  const url = `${BASE_URL}/api/proxy-article?id=${articleId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Proxy article failed: ${res.status} ${err}`);
  }
  const { article } = await res.json();
  return article as ZendeskArticle;
}

function getSearchTerm(q: string): string {
  const m = q.match(/(.+?)에 관한/);
  return m ? m[1].trim() : q.trim();
}

function isEnglishOnly(q: string): boolean {
  return !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
}

function getEquipmentFilter(q: string): string | undefined {
  const m = q.match(/([A-Za-z]+)\s*게이지/);
  return m ? `${m[1]}Gauge` : undefined;
}

export async function chatWithZendesk(userQuestion: string) {
  // 1) 한국어든 영어든 번역 or 그대로
  let eng: string;
  if (isEnglishOnly(userQuestion)) {
    eng = userQuestion.trim();
  } else {
    const kor = getSearchTerm(userQuestion);
    const trans = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '아래 한국어 단어를, Zendesk Help Center 검색에 가장 적합한 영어 단어/문구로 번역하세요.',
        },
        { role: 'user', content: kor },
      ],
    });
    eng = trans.choices[0].message.content!.trim();
  }

  // 2) 검색
  const equipment = getEquipmentFilter(userQuestion);
  const queryWithEquip = equipment ? `${equipment} ${eng}` : eng;
  const allResults = await searchZendeskAPI(queryWithEquip, 100);
  if (allResults.length === 0) {
    const kor = isEnglishOnly(userQuestion)
      ? userQuestion
      : getSearchTerm(userQuestion);
    return `죄송합니다. "${kor}"(${eng})에 해당하는 문서를 찾지 못했습니다.`;
  }

  // 3) 페이징
  const limit = 10;
  const pageResults = allResults.slice(0, limit);
  const footer =
    allResults.length > limit
      ? `\n\n총 ${allResults.length}건 중 일부만 표시됩니다. 더 보려면 '추가로 알려줘'라고 입력하세요.`
      : '';

  // 4) 공통 헤더
  const header = `“${eng}”로 검색한 최상위 ${pageResults.length}개 문서입니다:\n\n`;

  // 5) “설명” 요청이면 본문 2~3문장 요약
  if (
    /설명/.test(userQuestion) ||
    (isEnglishOnly(userQuestion) && /explain|describe/i.test(userQuestion))
  ) {
    const art = await getZendeskArticle(pageResults[0].id);

    // ← 여기서 art.body 가 아니라 art.body_text 를 사용!
    const plainBody = art.body_text.replace(/<[^>]+>/g, ' ').trim();
    const summ = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '아래 헬프센터 문서 본문을 읽고, 2~3문장으로 요약해서 설명해 주세요.',
        },
        { role: 'user', content: plainBody },
      ],
    });

    return (
      header +
      `1. **${art.title}**\n\n` +
      summ.choices[0].message.content +
      footer
    );
  }

  // 6) 그 외에는 리스트 응답
  const list = pageResults
    .map((r, i) => `${i + 1}. ${r.title}\n   🔗 ${r.url}`)
    .join('\n\n');

  return header + list + footer;
}
