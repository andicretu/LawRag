import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MODEL = "deepseek-chat";

export async function clarifyQuestion(originalQuestion: string, summary: string): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        "Ești un asistentul unui motor de cautare semantica. Reformulează întrebările vagi într-o formă clară, specifică și completă, folosind un limbaj juridic formal. Clarifica semantic si juridic termenii intrebarii. Nu răspunde la întrebare, nu oferi observatii sau explicatii despre ce ai facut, nu oferi linkuri sau referinte externe, doar clarifică formularea, intr-un mod care sa ajute cautarea documentelor relevante in etapa urmatoare"
    },
    {
      role: "user",
      content: summary
        ? `Rezumatul conversației până acum:\n${summary}\n\nÎntrebare originală:\n${originalQuestion}`
        : `Întrebare originală:\n${originalQuestion}`
    },
    {
      role: "user",
      content: "Care este versiunea clarificată a întrebării de mai sus?"
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

  interface DeepSeekResponse {
    choices: Array<{
      message: { content: string };
    }>;
  }

  const json = await response.json() as DeepSeekResponse;

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ DeepSeek clarification error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to clarify question.");
  }

  return json.choices[0].message.content.trim();
}
