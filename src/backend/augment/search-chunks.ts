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

async function fetchEmbedding(text: string): Promise<number[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const MODEL = "text-embedding-3-small";

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text, model: MODEL }),
    }
  ).finally(() => clearTimeout(timeout));

  const json = await response.json() as OpenAIEmbeddingResponse;
  if (!response.ok || !json.data || !json.data[0]) {
    throw new Error("Failed to get embedding for query");
  }

  return json.data[0].embedding;
}

export async function searchChunks(question: string): Promise<EmbeddedChunk[]> {
   console.log(`[${new Date().toISOString()}] 🟡 Starting searchChunks`);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`[${new Date().toISOString()}] ✅ Connected to database`);

  let questionEmbedding;
  try {
    console.time("⏱️ Fetch embeddings");
    questionEmbedding = await fetchEmbedding(question);
    console.timeEnd("⏱️ Fetch embeddings");
  } catch (err) {
    console.error("Error while fetching embedding", err);
    throw err;
  }

  const vecLiteral = `[${questionEmbedding.join(",")}]`;

  await client.query(`SET ivfflat.probes = 5;`);
  console.log(`[${new Date().toISOString()}] 🛠️ Set IVFFLAT probe count`);

  console.time("⏱️ Vector DB query");
  const { rows } = await client.query<{
    chunk_id: number;
    chunk_text: string;
    document_id: string;
    sequence_idx: number;
    source_id: string;
    title: string;
  }>(`
    SELECT c.chunk_id, 
           c.chunk_text, 
           c.document_id, 
           c.sequence_idx,
           d.source_id,
           d.title
    FROM law_chunks AS c
    JOIN documents AS d ON c.document_id = d.id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1
    LIMIT 10
  `
  , [vecLiteral]);
  console.timeEnd("⏱️ Vector DB query");

  await client.end();
  console.log(`[${new Date().toISOString()}] ✅ DB connection closed`);

  // Group chunks by title and keep only the newest (highest document_id)
const dedupedMap = new Map<string, typeof rows[0]>();

for (const row of rows) {
  const existing = dedupedMap.get(row.title);
  if (!existing || row.document_id > existing.document_id) {
    dedupedMap.set(row.title, row);
  }
}

// Get deduplicated top chunks (up to 5)
const dedupedChunks = Array.from(dedupedMap.values()).slice(0, 5);

  const relevantChunks: EmbeddedChunk[] = dedupedChunks.map(row => ({
    chunkId: row.chunk_id,
    text: row.chunk_text,
    sourceId: row.source_id ?? "unknown",
    chunkIndex: row.sequence_idx ?? 0,
    title: row.title ?? "Titlu necunoscut",
  }));

  console.log(relevantChunks);

    // 5) Persist to file
  await mkdir(RELEVANT_DIR, { recursive: true });
  await writeFile(
    SELECTED_CONTEXT_FILE,
    JSON.stringify({ question, relevantChunks }, null, 2),
    "utf-8"
  );
  console.log(`[${new Date().toISOString()}] 📦 Retrieved ${relevantChunks.length} relevant chunks`);

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
