import type { NextApiRequest, NextApiResponse } from "next";
import { chatWithZendesk } from "../../src/chatHandler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { question } = req.body as { question: string };
  if (!question) {
    return res.status(400).json({ error: "Missing `question` in body" });
  }
  try {
    const answer = await chatWithZendesk(question);
    return res.status(200).json({ answer });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}