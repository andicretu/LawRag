// embed-chunks.ts
import dotenv from "dotenv";
import path from "path";
import { readFile, writeFile, mkdir, readdir, access } from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const OPENAI_API_KEY = "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";
const MODEL = "text-embedding-3-small";

if (!OPENAI_API_KEY) {
  console.error("❌ Missing OpenAI API key");
  process.exit(1);
} else {
  console.log("🔑 OpenAI key loaded");
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const CHUNKS_DIR = path.join(OUTPUT_DIR, "chunks");
const EMBEDDINGS_FILE = path.join(OUTPUT_DIR, "embedded-chunks.json");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");
const MAX_CHARS = 24000; // ~7000-8000 tokens

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
  collector?: {
    lastCollectedId: number;
    collectedCount: number;
  };
  scraper?: {
    lastScrapedIds: string[];
    totalScraped: number;
  };
  chunker?: {
    lastChunkedId: number;
  };
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
  const input = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input,
      model: MODEL,
    }),
  });

  const json = await response.json();

  if (!response.ok || !json.data || !json.data[0]) {
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to fetch embedding.");
  }

  return json.data[0].embedding;
}

async function run() {
  await mkdir(path.dirname(EMBEDDINGS_FILE), { recursive: true });

  const progress = await loadProgress();
  if (!progress.embedder) {
    progress.embedder = { embeddedCount: 0, embeddedIds: [] };
  } else {
    progress.embedder.embeddedIds ??= [];
    progress.embedder.embeddedCount ??= 0;
  }
  

  const files = await readdir(CHUNKS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith("-chunks.json"));

  const allEmbeddedChunks: EmbeddedChunk[] = [];

  const embeddedSet = new Set(progress.embedder.embeddedIds);

    for (const file of jsonFiles) {
        const filePath = path.join(CHUNKS_DIR, file);
        const raw = await readFile(filePath, "utf-8");
        const chunks: Chunk[] = JSON.parse(raw);

        for (const chunk of chunks) {
            const id = `${chunk.sourceId}-${chunk.chunkIndex}`;
            
            if (embeddedSet.has(id)) {
                console.log(`⏭️  Skipping already embedded chunk: ${id}`);
                continue;
            }
            
            const embedding = await fetchEmbedding(chunk.text);
            const embedded: EmbeddedChunk = { ...chunk, embedding };
            allEmbeddedChunks.push(embedded);
            
            progress.embedder.embeddedIds.push(id);
            progress.embedder.embeddedCount++;
            await saveProgress(progress);
            
            console.log(`✅ Embedded chunk ${id}`);
        }
        
    }


  await writeFile(EMBEDDINGS_FILE, JSON.stringify(allEmbeddedChunks, null, 2));
  console.log("🎉 Done embedding chunks.");
}

run();
