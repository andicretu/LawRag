// cli-loader.ts
import readline from "readline/promises";
import path from "path";
import { readFile, access } from "fs/promises";
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
  const collector = progress.collector || {};
  const scraper = progress.scraper || {};
  const chunker = progress.chunker || {};
  const embedder = progress.embedder || {};

  console.log("\n📊 Current Document Load Status:");
  console.log(`🔍 Collector: Start ID = ${collector.lastCollectedId - collector.collectedCount + 1 || "-"}, Last ID = ${collector.lastCollectedId || "-"}, Count = ${collector.collectedCount || 0}`);
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
