// search-chunks.ts
import dotenv from "dotenv";
import path from "path";
import { readFile, writeFile, access } from "fs/promises";
import readline from "readline/promises";
import rerankChunks, { EmbeddedChunk } from "./rerank-chunks";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OPENAI_API_KEY = "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";

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OpenAI API key in environment. Check your .env file.");
  process.exit(1);
} else {
  console.log("🔑 OpenAI key loaded");
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const EMBEDDINGS_FILE = path.join(OUTPUT_DIR, "embedded-chunks.json");
const SELECTED_CONTEXT_FILE = path.join(OUTPUT_DIR, "selected-context.json");

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

async function askQuestion(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("❓ Enter your legal question: ");
  rl.close();
  return answer;
}

async function run() {
  if (!(await exists(EMBEDDINGS_FILE))) {
    console.error("❌ No embedded chunks found. Run embed-chunks.ts first.");
    return;
  }

  const chunks = await loadChunks();
  const question = await askQuestion();
  const questionEmbedding = await fetchEmbedding(question);

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(chunk.embedding, questionEmbedding),
  })).sort((a, b) => b.score - a.score);

  const topChunks = scored.slice(0, 10).map((s) => s.chunk);

  console.log("🔍 Reranking top results with LLM...");
  const relevantChunks = await rerankChunks(question, topChunks);

  await writeFile(SELECTED_CONTEXT_FILE, JSON.stringify({ question, relevantChunks }, null, 2));

  console.log("\n📚 Relevant chunks:");
  for (const chunk of relevantChunks) {
    console.log(`→ [${chunk.sourceId}-${chunk.chunkIndex}]\n${chunk.text}\n----------------------------------------`);
  }

  if (relevantChunks.length === 0) {
    console.log("⚠️ No relevant legal texts found.");
  }
}

run();
