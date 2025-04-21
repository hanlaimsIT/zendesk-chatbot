// src/config.ts
import dotenv from "dotenv";
dotenv.config();

// ▶ 여기에 export 가 반드시 있어야 모듈로 인식됩니다
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const ZENDESK_HOST    = process.env.ZENDESK_HOST!;
export const ZENDESK_API_KEY = process.env.ZENDESK_API_KEY!;
