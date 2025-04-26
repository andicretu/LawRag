// cli-loader.ts
import readline from "readline/promises";
import path from "path";
import { readFile, access } from "fs/promises";
import { Client } from "pg";
import { collectPrintableIds } from "./retrieve/collect-printable-ids";
import { scrapeLaws } from "./retrieve/scrape-laws";
import { chunkLaws } from "./retrieve/chunk-laws";
import { embedChunks } from "./augment/embed-chunks";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadProgress() {
  if (await exists(PROGRESS_FILE)) {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  }
  return {};
}

async function displayStatus() {
  const progress = await loadProgress();
  const scraper = progress.scraper || {};
  const chunker = progress.chunker || {};
  const embedder = progress.embedder || {};

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query('SELECT MIN(detalii_id) AS start_id, MAX(detalii_id) AS end_id, COUNT(*) AS total_count FROM printable_ids;');
  const { start_id, end_id, total_count } = rows[0] || {};

  await client.end();

  console.log("\n Current Document Load Status:");
  console.log(`🔍 Collector: Start ID = ${start_id || "-"}, Last ID = ${end_id || "-"}, Count = ${total_count || 0}`);
  console.log(`📥 Scraper: Scraped IDs = ${scraper.totalScraped || 0}`);
  console.log(`🧩 Chunker: Last Chunked ID = ${chunker.lastChunkedId || "-"}`);
  console.log(`🧠 Embedder: Embedded Count = ${embedder.embeddedCount || 0}`);
  console.log();
}

// loader-console.ts

export function logStep(step: string, message: string) {
  const label = step.padEnd(10, " ");
  console.log(`[${label}] ${message}`);
}


async function startCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    await displayStatus();
    const command = await rl.question("👉 Command (collect | scrape | chunk | embed | exit): ");

    if (command === "collect") {
      await collectPrintableIds();
    } else if (command === "scrape") {
      await scrapeLaws();
    } else if (command === "chunk") {
      await chunkLaws();
    } else if (command === "embed") {
      await embedChunks();
    } else if (command === "exit") {
      console.log("👋 Exiting CLI.");
      break;
    } else {
      console.log("❓ Unknown command.");
    }
  }

  rl.close();
}

startCLI();
