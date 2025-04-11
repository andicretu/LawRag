// search-chunks.ts (modular version)
import path from "path";
import { readFile, access, mkdir, writeFile } from "fs/promises";
import { EmbeddedChunk } from "./rerank-chunks";
import rerankChunks from "./rerank-chunks";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const EMBEDDINGS_FILE = path.join(OUTPUT_DIR, "embedded-chunks.json");
const RELEVANT_DIR = path.join(OUTPUT_DIR, "relevant-chunks");
const SELECTED_CONTEXT_FILE = path.join(RELEVANT_DIR, "selected-context.json");


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
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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
  
  const topScored = scored.slice(0, 1);
  
  // ✅ Display scored chunks before reranking
  console.log("\n📊 Top scored chunks by cosine similarity:");
  topScored.forEach(({ chunk, score }, index) => {
    console.log(`(${index + 1}) [Score: ${score.toFixed(4)}] ${chunk.sourceId}-${chunk.chunkIndex}\n${chunk.text}\n----------------------------------------`);
  });
  
  // 🔍 Rerank top chunks using LLM
  const relevantChunks = await rerankChunks(question, topScored.map((s) => s.chunk));
  

  console.log("\n📚 Relevant chunks:");
  for (const chunk of relevantChunks) {
    console.log(`→ [${chunk.sourceId}-${chunk.chunkIndex}]\n${chunk.text}\n----------------------------------------`);
  }

  if (relevantChunks.length === 0) {
    console.log("⚠️ No relevant legal texts found.");
  }

  await mkdir(RELEVANT_DIR, { recursive: true });
  await writeFile(SELECTED_CONTEXT_FILE, JSON.stringify({
    question,
    relevantChunks
  }, null, 2));

  return relevantChunks;
}

// CLI entry point for manual testing
/*if (process.argv[1].endsWith("search-chunks.ts")) {
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
}*/
export type { EmbeddedChunk };