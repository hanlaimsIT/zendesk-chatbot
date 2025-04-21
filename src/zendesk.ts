// src/zendesk.ts
import fetch from "node-fetch";
import { ZENDESK_HOST, ZENDESK_API_KEY } from "./config";

export interface ZendeskArticle {
  id: number;
  title: string;
  body_text: string;
  url: string;
}

export async function searchZendeskAPI(
  query: string,
  limit: number
): Promise<ZendeskArticle[]> {
    console.log("ZENDESK_HOST =", ZENDESK_HOST);
    const url = `${ZENDESK_HOST}/api/v2/help_center/articles/search.json?query=${encodeURIComponent(query)}`;
    console.log("Fetching URL =", url);
  const res = await fetch(
    `${ZENDESK_HOST}/api/v2/help_center/articles/search.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${ZENDESK_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`Zendesk API ${res.status}`);
  const { results } = await res.json();
  return results.slice(0, limit).map((a: any) => ({
    id: a.id,
    title: a.title,
    body_text: a.body_text,
    url: a.html_url
  }));
}

/**
 * 특정 Help Center 문서의 ID로 본문을 가져옵니다.
 */
export async function getZendeskArticle(
    articleId: number
  ): Promise<ZendeskArticle> {
    const url = `${ZENDESK_HOST}/api/v2/help_center/articles/${articleId}.json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ZENDESK_API_KEY}` }
    });
    if (!res.ok) {
      throw new Error(`Zendesk API error: ${res.status}`);
    }
    const data = await res.json();
    const art = data.article;
    // body_text가 null일 경우, 원본 body 필드를 사용
    const bodyText = art.body_text ?? art.body ?? "";
    return {
      id: art.id,
      title: art.title,
      body_text: bodyText,
      url: art.html_url
    };
  }
  
