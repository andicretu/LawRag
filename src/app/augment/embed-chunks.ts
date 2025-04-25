// embed-chunks.ts
import path from "path";
import { readFile, writeFile, mkdir, readdir, access } from "fs/promises";
import { logStep } from "../loader-console";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../../.env") });

const MODEL = "text-embedding-3-small";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ Embed chunks - Missing OpenAI API key in environment. Check your .env file.");
  process.exit(1);
} else {
  logStep("embedder", "🔑 OpenAI key loaded");
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const CHUNKS_DIR = path.join(OUTPUT_DIR, "chunks");
const EMBEDDINGS_FILE = path.join(OUTPUT_DIR, "embedded-chunks.json");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

interface ProgressData {
  embedder?: {
    embeddedCount: number;
    embeddedIds: string[];
  };
  [key: string]: unknown;
}

async function loadProgress(): Promise<ProgressData> {
  if (await exists(PROGRESS_FILE)) {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  }
  return {};
}

async function saveProgress(progress: ProgressData) {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchEmbedding(text: string): Promise<number[]> {
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
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to fetch embedding.");
  }

  return json.data[0].embedding;
}

export async function embedChunks(): Promise<number> {
  await mkdir(path.dirname(EMBEDDINGS_FILE), { recursive: true });

  const progress = await loadProgress();
  progress.embedder ??= { embeddedCount: 0, embeddedIds: [] };

  const files = await readdir(CHUNKS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith("-chunks.json"));

  let embeddedChunks: EmbeddedChunk[] = [];
  if (await exists(EMBEDDINGS_FILE)) {
    const raw = await readFile(EMBEDDINGS_FILE, "utf-8");
    embeddedChunks = JSON.parse(raw);
  }

  const embeddedSet = new Set(progress.embedder.embeddedIds);
  let count = 0;

  for (const file of jsonFiles) {
    const filePath = path.join(CHUNKS_DIR, file);
    const raw = await readFile(filePath, "utf-8");
    const chunks: Chunk[] = JSON.parse(raw);

    for (const chunk of chunks) {
      const id = `${chunk.sourceId}-${chunk.chunkIndex}`;
      if (embeddedSet.has(id)) {
        logStep("embedder", `⏭️  Skipping already embedded chunk: ${id}`);
        continue;
      }

      const embedding = await fetchEmbedding(chunk.text);
      embeddedChunks.push({ ...chunk, embedding });

      progress.embedder.embeddedIds.push(id);
      progress.embedder.embeddedCount++;
      count++;
      await saveProgress(progress);

      logStep("embedder", `✅ Embedded chunk ${id}`);
    }
  }

  await writeFile(EMBEDDINGS_FILE, JSON.stringify(embeddedChunks, null, 2));
  logStep("embedder", `💾 Saved ${count} new embeddings.`);
  return count;
}

if (require.main === module) {
  embedChunks();
}
