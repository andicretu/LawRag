import fetch from "node-fetch";

const MODEL = "deepseek-chat"; // or use your preferred model

export async function clarifyQuestion(originalQuestion: string): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        "Ești un asistent juridic. Reformulează întrebările vagi într-o formă clară, specifică și completă, folosind un limbaj juridic formal. Nu răspunde la întrebare, doar clarifică formularea."
    },
    {
      role: "user",
      content: `Întrebare originală:
${originalQuestion}`
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
