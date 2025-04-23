// pages/api/proxy-article.ts
import { NextApiRequest, NextApiResponse } from 'next';

const SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN!;
const EMAIL     = process.env.ZENDESK_EMAIL!;
const TOKEN     = process.env.ZENDESK_API_TOKEN!;
const BASE_URL  = `https://${SUBDOMAIN}.zendesk.com/api/v2/help_center/articles`;

const BASIC = Buffer
  .from(`${EMAIL}/token:${TOKEN}`)
  .toString('base64');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.debug('[proxy-article] Incoming request', {
    method: req.method,
    query: req.query,
  });

  try {
    const id = req.query.id;
    if (!id || Array.isArray(id)) {
      console.error('[proxy-article] ❌ Invalid or missing `id`', id);
      return res.status(400).json({ error: 'Missing or invalid article id' });
    }

    const url = `${BASE_URL}/${id}.json`;
    console.debug('[proxy-article] Fetching Zendesk', { url, authUser: EMAIL });

    const zendeskRes = await fetch(url, {
      headers: {
        Authorization: `Basic ${BASIC}`,
        'Content-Type': 'application/json',
      },
    });

    console.debug('[proxy-article] Zendesk responded', {
      status: zendeskRes.status,
      statusText: zendeskRes.statusText,
      headers: {
        'x-rate-limit-remaining': zendeskRes.headers.get('x-rate-limit-remaining'),
        'content-length': zendeskRes.headers.get('content-length'),
      },
    });

    if (!zendeskRes.ok) {
      const errText = await zendeskRes.text();
      console.error('[proxy-article] ❌ Zendesk API error', {
        status: zendeskRes.status,
        body: errText.slice(0, 200) + (errText.length > 200 ? '…' : ''),
      });
      return res.status(zendeskRes.status).json({ error: errText });
    }

    const payload = await zendeskRes.json();
    const art = payload.article;
    console.debug('[proxy-article] ✅ Retrieved article', {
      id: art?.id,
      title: art?.title,
    });

    // HTML 태그 제거해서 순수 텍스트로 변환
    const bodyHtml: string = art.body ?? '';
    const bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    res.status(200).json({
      article: {
        ...art,
        body_text: bodyText,
      },
    });
  } catch (e: any) {
    console.error('[proxy-article] 💥 Unexpected error', e);
    res.status(500).json({ error: e.message });
  }
}
