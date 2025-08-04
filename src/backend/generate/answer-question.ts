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
      content: `Ești un asistent juridic specializat în legislația română. Răspunde întrebărilor strict pe baza contextului oferit. 
      Include întotdeauna referințele legale exacte (articol, alineat, număr) și inserează hyperlink-uri clicabile direct în text, folosind sintaxa Markdown – de exemplu: [Ordinul MS nr. 1224/2010 Art. 5 alin. 2](https://legislatie.just.ro/Public/DetaliiDocument/121072). 
      Evită linkurile generice (ex. https://legislatie.just.ro) – oferă linkul complet către documentul de lege, dacă este cunoscut, sau menționează că nu este disponibil.
      Explică legăturile dintre documentele oferite în context și întrebarea utilizatorului, precum și conexiunile juridice dintre alte documente relevante și contextul prezentat.
      Include hyperlink-uri doar dacă știi cu siguranță linkul corect. Nu inventa linkuri – dacă nu e disponibil, scrie (link indisponibil) sau nu insera link.`,
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

  if (json?.choices?.[0]?.message?.content) {
    console.log("✅ DeepSeek raw content:\n", json.choices[0].message.content);
  } else {
    console.error("❌ DeepSeek API returned no content:", JSON.stringify(json, null, 2));
  }

  if (!response.ok || !json.choices?.[0]?.message?.content) {
    console.error("❌ DeepSeek API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to generate legal answer from context.");
  }

  return json.choices[0].message.content.trim();
}
