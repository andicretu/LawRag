import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const API_URL = "https://api.openai.com/v1/chat/completions";

const question = "Care este sporul salarial de care beneficiază persoanele responsabile cu culegerea, evidenţa şi transmiterea informaţiilor referitoare la copiii care au fost sau urmează să fie adoptaţi?";

const context = `
Articolul 7:
Persoanele responsabile cu culegerea, evidenţa şi transmiterea informaţiilor referitoare la copiii care au fost sau urmează să fie adoptaţi au obligaţia să păstreze confidenţialitatea acestor informaţii. Nerespectarea acestor obligaţii atrage răspunderea penală, administrativă sau disciplinară, după caz. Sancţiunile privind încetarea raporturilor de serviciu sau a raporturilor contractuale de muncă se cumulează cu răspunderea juridică de altă natură corespunzătoare faptei săvârşite.

Articolul 10:
(1) Personalul Oficiului este format din funcționari publici și personal contractual numit, respectiv încadrat, potrivit legii.
(2) Personalul Oficiului este salarizat în conformitate cu prevederile legale în vigoare aplicabile personalului din cadrul aparatului de lucru al Guvernului.
(3) Personalul prevăzut la art. 7 beneficiază de un spor de confidenţialitate de până la 15% din salariul de bază, cuantumul acestuia urmând a se stabili prin ordin al secretarului de stat, cu avizul ministrului delegat pentru coordonarea Secretariatului General al Guvernului.
`;

async function askLLM() {
  const body = {
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a helpful legal assistant that answers clearly based only on provided context.",
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion:\n${question}`,
      },
    ],
    temperature: 0.3,
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to get answer.");
  }

  console.log("🧠 Answer:\n", json.choices[0].message.content);
}

askLLM();
