// answer-question.ts
import { EmbeddedChunk } from "./rerank-chunks";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/*const MODEL = "gpt-4";

export async function answerFromContext(question: string, relevantChunks: EmbeddedChunk[]): Promise<string> {
  const contextText = relevantChunks.map((c) => c.text).join("\n\n");

  const messages = [
    {
      role: "system",
      content: "You are a legal assistant that answers questions based strictly on Romanian law."
    },
    {
      role: "user",
      content: `Context:
${contextText}`
    },
    {
      role: "user",
      content: `Based strictly on the legal context provided, answer this legal question:
      ${question}`
    }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2
    })
  });

  const json = await response.json();

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to generate legal answer from context.");
  }

  return json.choices[0].message.content;
}*/

const MODEL = "deepseek-chat"; // DeepSeek's model name

export async function answerFromContext(question: string, relevantChunks: EmbeddedChunk[]): Promise<string> {
  const contextText = relevantChunks.map((c) => c.text).join("\n\n");

  const messages = [
    {
      role: "system",
      content: "You are a legal assistant that answers questions based strictly on Romanian law."
    },
    {
      role: "user",
      content: `Context:
${contextText}`
    },
    {
      role: "user",
      content: `Based strictly on the legal context provided, answer this legal question:
${question}`
    }
  ];

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

  const json = await response.json();

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ DeepSeek API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to generate legal answer from context.");
  }

  return json.choices[0].message.content.trim();
}

