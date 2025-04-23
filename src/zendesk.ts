import fetch from 'node-fetch';
import {
  ZENDESK_SUBDOMAIN,
  ZENDESK_EMAIL,
  ZENDESK_API_TOKEN,
} from './config';

const BASE_URL = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
// email/token:api_token 을 Base64 인코딩
const BASIC_AUTH = Buffer
  .from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`)
  .toString('base64');

export interface ZendeskArticle {
  id: number;
  title: string;
  /** 원본 HTML 본문 */
  body: string;
  /** 요약/처리용 텍스트 본문 */
  body_text: string;
  /** Zendesk JSON API 엔드포인트 URL */
  url: string;
  /** Help Center 페이지 URL */
  html_url: string;
}

export async function searchZendeskAPI(
  query: string,
  limit: number
): Promise<ZendeskArticle[]> {
  const url = `${BASE_URL}/help_center/articles/search.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Basic ${BASIC_AUTH}`,
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) throw new Error(`Zendesk API error: ${res.status}`);
  const { results } = await res.json();
  return (results as any[])
    .slice(0, limit)
    .map(a => ({
      id:        a.id,
      title:     a.title,
      body:      a.body      ?? '',
      body_text: a.body_text ?? (a.body ?? '').replace(/<[^>]+>/g, ' '),
      url:       a.url,
      html_url:  a.html_url,
    }));
}

export async function getZendeskArticle(
  articleId: number
): Promise<ZendeskArticle> {
  const url = `${BASE_URL}/help_center/articles/${articleId}.json`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Basic ${BASIC_AUTH}`,
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) {
    throw new Error(`Zendesk API error: ${res.status}`);
  }
  const { article: art } = await res.json();
  return {
    id:        art.id,
    title:     art.title,
    body:      art.body      ?? '',
    body_text: art.body_text ?? (art.body ?? '').replace(/<[^>]+>/g, ' '),
    url:       art.url,
    html_url:  art.html_url,
  };
}
