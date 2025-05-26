


// chunk-laws.ts
import { readFile, writeFile, mkdir, readdir, access } from "fs/promises";
import path from "path";
import { logStep } from "../loader-console";

const LAWS_DIR = path.resolve(process.cwd(), "output", "laws");
const CHUNKS_DIR = path.resolve(process.cwd(), "output", "chunks");
const MAX_PARAGRAPHS_PER_CHUNK = 10;

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isTableLine(line: string): boolean {
  return /[─-╿|+]/.test(line.trim());
}

function splitIntoChunks(paragraphs: string[], maxChunkSize: number): { text: string[][]; table: string[][] } {
  const textChunks: string[][] = [];
  const tableChunks: string[][] = [];
  let currentTextChunk: string[] = [];

  for (const para of paragraphs) {
    if (isTableLine(para)) {
      if (currentTextChunk.length) {
        textChunks.push(currentTextChunk);
        currentTextChunk = [];
      }
      tableChunks.push([para]);
    } else {
      currentTextChunk.push(para);
      if (currentTextChunk.length >= maxChunkSize) {
        textChunks.push(currentTextChunk);
        currentTextChunk = [];
      }
    }
  }
  if (currentTextChunk.length) {
    textChunks.push(currentTextChunk);
  }

  return { text: textChunks, table: tableChunks };
}

async function processLawFile(filePath: string, sourceId: number) {
  const chunkFileName = path.basename(filePath).replace(".json", "-chunks.json");
  const chunkFilePath = path.join(CHUNKS_DIR, chunkFileName);

  if (await exists(chunkFilePath)) {
    logStep("chunker", `⏭️  Already chunked: ${chunkFileName}`);
    return false;
  }

  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);
  const { code, url, fetchedAt, paragraphs } = data;

  if (!paragraphs || !Array.isArray(paragraphs) || paragraphs.length === 0) {
    logStep("chunker", `⚠️  No paragraphs in sourceId ${sourceId}`);
    return false;
  }

  const { text: textChunks, table: tableChunks } = splitIntoChunks(paragraphs, MAX_PARAGRAPHS_PER_CHUNK);

  const outputChunks = [
    ...textChunks.map((chunkParas, index) => ({
      sourceId,
      code,
      url,
      fetchedAt,
      chunkIndex: index,
      type: "text",
      text: chunkParas.join("\n")
    })),
    ...tableChunks.map((chunkParas, index) => ({
      sourceId,
      code,
      url,
      fetchedAt,
      chunkIndex: textChunks.length + index,
      type: "table",
      text: chunkParas.join("\n")
    }))
  ];

  await writeFile(chunkFilePath, JSON.stringify(outputChunks, null, 2));
  logStep("chunker", `✅ Chunked ${chunkFileName}`);
  return true;
}

export async function chunkLaws(): Promise<number> {
  await mkdir(CHUNKS_DIR, { recursive: true });

  const files = await readdir(LAWS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  let count = 0;
  for (const file of jsonFiles) {
    const sourceId = parseInt(file.replace(".json", ""), 10);
    if (isNaN(sourceId)) continue;

    const didChunk = await processLawFile(path.join(LAWS_DIR, file), sourceId);
    if (didChunk) count++;
  }

  logStep("chunker", `📦 Chunked ${count} new laws.`);
  return count;
}

if (require.main === module) {
  chunkLaws();
}

