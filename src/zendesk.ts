// src/zendesk.ts
import {
    ZENDESK_SUBDOMAIN,
    ZENDESK_EMAIL,
    ZENDESK_API_TOKEN,
  } from "./config";
  
  const BASE_URL = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
  // email/token:api_token 을 Base64 인코딩
  const BASIC_AUTH = Buffer
    .from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`)
    .toString("base64");

    
    
  export interface ZendeskArticle {
    id: number;
    title: string;
    body_text: string;
    url: string;
  }
  
  /**
   * Zendesk Help Center에서 문서를 검색합니다.
   * @param query 검색어
   * @param limit 최대 가져올 개수 (기본 100)
   */
  export async function searchZendeskAPI(
    query: string,
    limit = 100
  ): Promise<ZendeskArticle[]> {
    const url =
      `${BASE_URL}/help_center/articles/search.json` +
      `?query=${encodeURIComponent(query)}` +
      `&per_page=${limit}`;
  
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        "Content-Type": "application/json",
      },
    });
  
    if (!res.ok) {
      throw new Error(`Zendesk API error: ${res.status}`);
    }
  
    const json = await res.json();
    const results = (json.results ?? []) as any[];
  
    return results.map((a) => ({
      id: a.id,
      title: a.title,
      body_text: a.body_text ?? a.body ?? "",
      url: a.html_url,
    }));
  }
  
  /**
   * 특정 문서 ID의 상세 정보를 가져옵니다.
   * @param articleId 문서 ID
   */
  export async function getZendeskArticle(
    articleId: number
  ): Promise<ZendeskArticle> {
    const url =
      `${BASE_URL}/help_center/articles/${articleId}.json`;
  
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        "Content-Type": "application/json",
      },
    });
  
    if (!res.ok) {
      throw new Error(`Zendesk API error: ${res.status}`);
    }
  
    const json = await res.json();
    const art = json.article;
  
    return {
      id: art.id,
      title: art.title,
      body_text: art.body_text ?? art.body ?? "",
      url: art.html_url,
    };
  }
  