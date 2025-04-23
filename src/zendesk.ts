import fetch from 'node-fetch';
import axios from 'axios';
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
  body_text: string;
  url: string;
}

export async function searchZendeskAPI(
    query: string,
    limit: number
  ): Promise<ZendeskArticle[]> {
    const resp = await axios.get(
      `${BASE_URL}/help_center/articles/search.json`,
      {
        params: { query, per_page: limit },
        auth: {
          // username 에는 반드시 “email/token” 형태를 넣습니다
          username: `${ZENDESK_EMAIL}/token`,
          password: ZENDESK_API_TOKEN
        }
      }
    );
    const results = resp.data.results as any[];
    return results.slice(0, limit).map(a => ({
      id:        a.id,
      title:     a.title,
      body_text: a.body_text ?? a.body ?? '',
      url:       a.html_url,
    }));
  }

  export async function getZendeskArticle(
    articleId: number
  ): Promise<ZendeskArticle> {
    const resp = await axios.get(
      `${BASE_URL}/help_center/articles/${articleId}.json`,
      {
        auth: {
          username: `${ZENDESK_EMAIL}/token`,
          password: ZENDESK_API_TOKEN
        }
      }
    );
    const art = resp.data.article;
    return {
      id:        art.id,
      title:     art.title,
      body_text: art.body_text ?? art.body ?? '',
      url:       art.html_url,
    };
  }
  