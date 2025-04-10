// search-chunks.ts (modular version)
//import dotenv from "dotenv";
import path from "path";
import { readFile, access } from "fs/promises";
import { EmbeddedChunk } from "./rerank-chunks";
import rerankChunks from "./rerank-chunks";
import readline from "readline/promises";

//dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const EMBEDDINGS_FILE = path.join(OUTPUT_DIR, "embedded-chunks.json");

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadChunks(): Promise<EmbeddedChunk[]> {
  const raw = await readFile(EMBEDDINGS_FILE, "utf-8");
  return JSON.parse(raw);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const OPENAI_API_KEY = "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";
  const MODEL = "text-embedding-3-small";

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text, model: MODEL })
  });

  const json = await response.json();
  if (!response.ok || !json.data || !json.data[0]) {
    throw new Error("Failed to get embedding for query");
  }

  return json.data[0].embedding;
}

export async function searchChunks(question: string): Promise<EmbeddedChunk[]> {
  if (!(await exists(EMBEDDINGS_FILE))) {
    throw new Error("❌ No embedded chunks found. Run embed-chunks.ts first.");
  }

  const chunks = await loadChunks();
  const questionEmbedding = await fetchEmbedding(question);

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(chunk.embedding, questionEmbedding),
  })).sort((a, b) => b.score - a.score);

  const topChunks = scored.slice(0, 10).map((s) => s.chunk);
  const relevantChunks = await rerankChunks(question, topChunks);

  return relevantChunks;
}

// CLI entry point for manual testing
if (process.argv[1].endsWith("search-chunks.ts")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("❓ Enter your legal question: ").then(async (question) => {
    rl.close();
    try {
      const results = await searchChunks(question);
      console.log("\n📚 Relevant chunks:");
      for (const chunk of results) {
        console.log(`→ [${chunk.sourceId}-${chunk.chunkIndex}]\n${chunk.text}\n----------------------------------------`);
      }
      if (results.length === 0) {
        console.log("⚠️ No relevant legal texts found.");
      }
    } catch (err) {
      console.error("❌ Error:", err);
    }
  });
}
export type { EmbeddedChunk };