// collect-printable-ids.ts (PostgreSQL version)
import puppeteer from "puppeteer";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";
import { logStep } from "../loader-console";
import { Client } from "pg";
import dotenv from "dotenv";
import readline from "readline";


dotenv.config();

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");

let stopRequested = false;

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (str, key) => {
    if (key.name === "q" || key.name === "Q") {
      console.log("👋 Quit requested. Finishing current loop...");
      stopRequested = true;
    }
  });
}
const START_ID = 111000;
const END_ID = 113000;

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

type ProgressData = {
  collector?: {
    lastCollectedId: number;
    collectedCount: number;
  };
  scraper?: unknown;
  chunker?: unknown;
  embedder?: unknown;
};

async function loadProgress(): Promise<ProgressData> {
  if (await exists(PROGRESS_FILE)) {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  }
  return {};
}

async function saveProgress(progress: ProgressData): Promise<void> {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

export async function collectPrintableIds() {
  console.log("Press 'Q' at any time to stop collecting.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  const progress = await loadProgress();
  if (!progress.collector) {
    progress.collector = { lastCollectedId: START_ID - 1, collectedCount: 0 };
  }

  const lastCollectedId = Number(progress.collector?.lastCollectedId ?? START_ID - 1);
  let collectedCount = Number(progress.collector?.collectedCount ?? 0);

  if (isNaN(lastCollectedId)) {
    logStep("collector", `⚠️ Invalid lastCollectedId in progress file. Resetting to ${START_ID - 1}`);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  logStep("collector", `🔍 Starting from ID ${lastCollectedId + 1}, collected so far: ${collectedCount}`);

  try {
    for (let currentId = lastCollectedId + 1;
      currentId <= END_ID && !stopRequested;
      currentId++)
     {
      const url = `http://legislatie.just.ro/Public/DetaliiDocument/${currentId}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });

        const code = await page.evaluate(() => {
          const a = document.querySelector('a[href*="FormaPrintabila"]');
          return a ? a.getAttribute("href")?.split("/").pop() : null;
        });

        if (code) {
          const res = await client.query(
            `INSERT INTO printable_ids (detalii_id, printable_code)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [currentId, code]
          );

          if (res.rowCount! > 0) {
            collectedCount++;
            logStep("collector", `✅ Inserted: ${currentId}:${code}`);
          } else {
            logStep("collector", `❌ Skipped ${currentId} (already in DB)`);
          }
        } else {
          logStep("collector", `❌ Skipping ${currentId} (no printable code)`);
        }

        progress.collector = { lastCollectedId: currentId, collectedCount };
        await saveProgress(progress);
      } catch {
        logStep("collector", `⚠️ Skipping ${currentId} (timeout/error)`);
      }
    }
  } finally {
    await browser.close();
    await client.end();
  }

  logStep("collector", `🎉 Done. Total collected: ${collectedCount}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectPrintableIds();
}
