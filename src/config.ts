// src/config.ts
import dotenv from "dotenv";
dotenv.config();

// ▶ 여기에 export 가 반드시 있어야 모듈로 인식됩니다
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN!;   // ex) "hanlaims5161"
export const ZENDESK_EMAIL     = process.env.ZENDESK_EMAIL!;       // ex) "you@yourcompany.com"
export const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN!;   // ex) "uVf1YmAZCb…"
