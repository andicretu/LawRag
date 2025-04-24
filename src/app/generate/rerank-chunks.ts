
import { writeFile } from "fs/promises";
import path from "path";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const RELEVANT_FILE = path.join(OUTPUT_DIR, "relevant-chunks.json");

interface Chunk {
  sourceId: string;
  code: string;
  url: string;
  fetchedAt: string;
  chunkIndex: number;
  type: "text" | "table";
  text: string;
}

interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

async function rerankChunks(question: string, topChunks: EmbeddedChunk[]) {

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error("❌ Missing OpenAI API key(rerank-chunks)");
    process.exit(1);
  }

  const prompt = (chunkText: string) =>
    `Întrebare: ${question}\nText legal:\n"""${chunkText}"""\nRăspunde textul la întrebare? Răspunde doar cu \"DA\" sau \"NU\".`;

  const relevantChunks: EmbeddedChunk[] = [];

  for (const chunk of topChunks) {
    const body = {
      model: "gpt-4",
      messages: [
        { role: "user", content: prompt(chunk.text) }
      ],
      temperature: 0
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim().toUpperCase();

    if (content && content.trim().toUpperCase().startsWith("DA")) {
      relevantChunks.push(chunk);
    }
    console.log(`🧪 LLM check for chunk ${chunk.sourceId}-${chunk.chunkIndex}`);
    console.log("➡️ Prompt:\n" + prompt(chunk.text).slice(0, 500));
    console.log("🧠 Response:\n" + content);
  }

  await writeFile(RELEVANT_FILE, JSON.stringify(relevantChunks, null, 2));
  return relevantChunks;
}

export default rerankChunks;
export type { EmbeddedChunk };
