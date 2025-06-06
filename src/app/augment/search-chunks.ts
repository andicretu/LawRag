// search-chunks-db.ts
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import fetch from "node-fetch";
import { mkdir, writeFile } from "fs/promises";
import type { EmbeddedChunk } from "../../types/EmbeddedChunk";


dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const RELEVANT_DIR = path.resolve("output", "relevant-chunks");
const SELECTED_CONTEXT_FILE = path.join(RELEVANT_DIR, "selected-context.json");

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
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
    body: JSON.stringify({ input: text, model: MODEL }),
  });

  const json = await response.json() as OpenAIEmbeddingResponse;
  if (!response.ok || !json.data || !json.data[0]) {
    throw new Error("Failed to get embedding for query");
  }

  return json.data[0].embedding;
}

export async function searchChunks(question: string): Promise<EmbeddedChunk[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const questionEmbedding = await fetchEmbedding(question);

  const { rows } = await client.query<{
    chunk_id: number;
    chunk_text: string;
    embedding: string;
    source_id: string;
    chunk_index: number;
  }>(`
    SELECT chunk_id, chunk_text, embedding::text, document_id, sequence_idx
    FROM law_chunks
    WHERE embedding IS NOT NULL
  `);

  await client.end();

  const chunks: EmbeddedChunk[] = rows.map(row => ({
    chunkId: row.chunk_id,
    text: row.chunk_text,
    embedding: JSON.parse(row.embedding),
    sourceId: row.source_id ?? "unknown",
    chunkIndex: row.chunk_index ?? 0,
  }));

  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(chunk.embedding, questionEmbedding),
  })).sort((a, b) => b.score - a.score);

  const relevantChunks = scored.slice(0, 5).map(s => s.chunk);

  console.log("\n📚 Top chunks (no reranking):");
  for (const chunk of relevantChunks) {
    console.log(`→ [${chunk.sourceId}-${chunk.chunkIndex}]\n${chunk.text}\n----------------------------------------`);
  }

  await mkdir(RELEVANT_DIR, { recursive: true });
  await writeFile(SELECTED_CONTEXT_FILE, JSON.stringify({ question, relevantChunks }, null, 2));
  console.log("📁 Saved to:", SELECTED_CONTEXT_FILE);

  return relevantChunks;
}

// CLI entry
if (process.argv[1].endsWith("search-chunks-db.ts")) {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("❓ Enter your legal question: ", async (question) => {
    rl.close();
    try {
      await searchChunks(question);
    } catch (err) {
      console.error("❌ Error:", err);
    }
  });
}
