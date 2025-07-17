// answer-question.ts
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import type { EmbeddedChunk } from "../../types/EmbeddedChunk";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MODEL = "deepseek-chat";

export async function answerFromContext(question: string, relevantChunks: EmbeddedChunk[]): Promise<string> {
  const contextText = relevantChunks.map((c) => c.text).join("\n\n").slice(0, 6000); // Limit to prevent context overflow

  const messages = [
    {
      role: "system",
      content: "Ești un asistent juridic specializat în legislația română. Răspunde întrebărilor strict pe baza contextului oferit. Include întotdeauna referințele legale exacte, precum articolul, alineatul și numărul, atunci când sunt disponibile."
    },
    {
      role: "user",
      content: `Context juridic:\n${contextText}`
    },
    {
      role: "user",
      content: `Pe baza exclusivă a contextului legal de mai sus, răspunde clar și concis la următoarea întrebare, incluzând toate referințele relevante:\n${question}`
    }
  ]

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2
    })
  });

  interface DeepSeekResponse {
    choices: Array<{
      message: { content: string };
    }>;
  }

  const json = await response.json() as DeepSeekResponse;

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ DeepSeek API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to generate legal answer from context.");
  }

  return json.choices[0].message.content.trim();
}
