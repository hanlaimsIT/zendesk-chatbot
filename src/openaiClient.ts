// src/openaiClient.ts
import OpenAI from "openai";
import { OPENAI_API_KEY } from "./config";

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// create() 의 parameters[0]에서 functions 프로퍼티 타입만 추출
type ChatParams = Parameters<typeof openai.chat.completions.create>[0];
type FunctionSpec = NonNullable<ChatParams["functions"]>[number];

export const zendeskFunctions: FunctionSpec[] = [
  {
    name: "searchZendesk",
    description: "Zendesk 헬프 센터에서 키워드를 검색합니다.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string",  description: "검색어" },
        limit: { type: "integer", description: "최대 결과 수" }
      },
      required: ["query", "limit"]
    }
  }
];
