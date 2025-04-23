// pages/api/proxy-search.ts
import { NextApiRequest, NextApiResponse } from 'next';

const SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN!;
const EMAIL     = process.env.ZENDESK_EMAIL!;
const TOKEN     = process.env.ZENDESK_API_TOKEN!;
const BASE_URL  = `https://${SUBDOMAIN}.zendesk.com/api/v2/help_center/articles`;

const BASIC = Buffer
  .from(`${EMAIL}/token:${TOKEN}`)
  .toString('base64');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── Debug Logging ──────────────────────────────────────────
  console.log('[proxy‑search] req.query =', req.query);
  console.log('[proxy‑search] ENV =', {
    SUBDOMAIN: process.env.ZENDESK_SUBDOMAIN,
    EMAIL:     process.env.ZENDESK_EMAIL?.slice(0,5) + '…',
    HAS_TOKEN: Boolean(process.env.ZENDESK_API_TOKEN),
  });
  // ─────────────────────────────────────────────────────────────

  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    console.log('[proxy‑search] searching for', q);
    const BASE_GUIDE = `https://${SUBDOMAIN}.zendesk.com/api/v2/guide`;
    const url = `${BASE_GUIDE}/search?filter[locales]=ko&query=${encodeURIComponent(q)}`;
    console.log('[proxy‑search] fetching URL =', url);

    const zendeskRes = await fetch(url, {
      headers: {
        Authorization: `Basic ${BASIC}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[proxy‑search] Zendesk status =', zendeskRes.status);
    if (!zendeskRes.ok) {
      const err = await zendeskRes.text();
      console.error('[proxy‑search] Zendesk error body =', err);
      return res.status(zendeskRes.status).json({ error: err });
    }

    const { results } = await zendeskRes.json();
    console.log('[proxy‑search] returning results count =', results.length);
    return res.status(200).json({ results });
  } catch (e: any) {
    console.error('[proxy‑search] caught error =', e);
    return res.status(500).json({ error: e.message });
  }
}
