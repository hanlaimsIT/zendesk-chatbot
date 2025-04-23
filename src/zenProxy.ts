// src/zenProxy.ts
import fetch from 'node-fetch';
import {
    ZENDESK_SUBDOMAIN,
    ZENDESK_EMAIL,
    ZENDESK_API_TOKEN,
  } from './config';
const ZENDESK_BASE = `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
const AUTH = `Basic ${Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64')}`;

export async function proxySearch(query: string) {
  const url = `${ZENDESK_BASE}/guide/search?filter[locales]=ko&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const { results } = await res.json();
  return results; // 배열 내에 공개·비공개 모두 포함
}

export async function proxyArticle(articleId: number) {
  const url = `${ZENDESK_BASE}/help_center/articles/${articleId}.json`;
  const res = await fetch(url, { headers: { Authorization: AUTH } });
  if (!res.ok) throw new Error(`Fetch article failed: ${res.status}`);
  const { article } = await res.json();
  return {
    ...article,
    body_text: (article.body_text ?? article.body).replace(/<[^>]+>/g, ' ')
  };
}
