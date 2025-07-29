import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MODEL = "deepseek-chat";

export async function generateSummary({
  previousSummary,
  question,
  answer,
}: {
  previousSummary: string;
  question: string;
  answer: string;
}): Promise<string> {
  const prompt = `
Ești un asistent juridic care menține un rezumat concis al unei conversații anterioare între un utilizator și un AI, referitoare la întrebări din domeniul legal.

Rezumat anterior:
${previousSummary || "(niciun rezumat până acum)"}

Interacțiune nouă:
Întrebare: ${question}
Răspuns: ${answer}

Scrie un rezumat actualizat, care păstrează doar ideile esențiale și scopul legal al conversației.
  `.trim();

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    })
  });

  console.log(response.status, response.statusText);
    if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ DeepSeek API error (summary):", errorText);
        throw new Error(`Failed to generate summary: ${errorText}`);
    }
    
  interface DeepSeekResponse {
    choices: Array<{
      message: { content: string };
    }>;
  }

  const json = await response.json() as DeepSeekResponse;

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ DeepSeek API error (summary):", JSON.stringify(json, null, 2));
    throw new Error("Failed to generate summary.");
  }

  return json.choices[0].message.content.trim();
}
