import type { NextApiRequest, NextApiResponse } from "next";
import { chatWithZendesk } from "../../src/chatHandler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // question 또는 message 둘 다 받아들임
  const { question, message } = req.body as {
    question?: string;
    message?: string;
  };
  // question 우선, 없으면 message
  const text = question ?? message;
  if (!text) {
    return res
      .status(400)
      .json({ error: "Missing `question` or `message` in body" });
  }

  try {
    const answer = await chatWithZendesk(text);
    return res.status(200).json({ answer });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}
