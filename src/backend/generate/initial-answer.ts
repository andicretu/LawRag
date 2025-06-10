const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("❌ Initial answer - Missing OpenAI API key in environment.");
}

export default async function fetchInitialAnswer(question: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a legal assistant. Answer questions as accurately and clearly as possible based only on your training data."
        },
        {
          role: "user",
          content: question,
        }
      ]
    })
  });

  const json = await response.json();

  if (!response.ok || !json.choices || !json.choices[0]) {
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to fetch initial answer from LLM.");
  }

  return json.choices[0].message.content.trim();
}
