// rerank-chunks.ts
import dotenv from "dotenv";
import path from "path";
import { writeFile } from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OPENAI_API_KEY = "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";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const RELEVANT_FILE = path.join(OUTPUT_DIR, "relevant-chunks.json");

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OpenAI API key");
  process.exit(1);
}

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

    if (content === "DA") {
      relevantChunks.push(chunk);
    }
  }

  await writeFile(RELEVANT_FILE, JSON.stringify(relevantChunks, null, 2));
  return relevantChunks;
}

export default rerankChunks;
export type { EmbeddedChunk };
