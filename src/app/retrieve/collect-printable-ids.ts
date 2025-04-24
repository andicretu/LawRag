// collect-printable-ids.ts
import puppeteer from "puppeteer";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";
import { logStep } from "../loader-console";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");
const IDS_FILE = path.join(OUTPUT_DIR, "printable-ids.json");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");
const MAX_CODES = 260;
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
  await mkdir(OUTPUT_DIR, { recursive: true });

  const progress = await loadProgress();
  if (!progress.collector) {
    progress.collector = { lastCollectedId: START_ID - 1, collectedCount: 0 };
  }

  let lastCollectedId = Number(progress.collector?.lastCollectedId ?? START_ID - 1);
  let collectedCount = Number(progress.collector?.collectedCount ?? 0);
  
  if (isNaN(lastCollectedId)) {
    logStep("collector", `⚠️ Invalid lastCollectedId in progress file. Resetting to ${START_ID - 1}`);
  }
  

  let codes: string[] = [];
  if (await exists(IDS_FILE)) {
    const raw = await readFile(IDS_FILE, "utf-8");
    const data = JSON.parse(raw);
    codes = Array.isArray(data.codes) ? data.codes : [];
  }

  const existingCodes = new Set(codes.map((entry) => entry.split(":")[1]));
  let currentId = lastCollectedId + 1;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  logStep("collector", `🔍 Starting from ID ${currentId}, collected so far: ${collectedCount}`);

  try {
    for (; currentId <= END_ID && collectedCount < MAX_CODES; currentId++) {
      const url = `http://legislatie.just.ro/Public/DetaliiDocument/${currentId}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });

        const code = await page.evaluate(() => {
          const a = document.querySelector('a[href*="FormaPrintabila"]');
          return a ? a.getAttribute("href")?.split("/").pop() : null;
        });

        if (code && !existingCodes.has(code)) {
          const fullEntry = `${currentId}:${code}`;
          codes.push(fullEntry);
          existingCodes.add(code);
          collectedCount++;
          logStep("collector", `✅ Found: ${fullEntry}`);
        } else {
          logStep("collector", `❌ Skipping ${currentId} (no printable or duplicate)`);
        }

        lastCollectedId = currentId;
        progress.collector = { lastCollectedId, collectedCount };
        await writeFile(IDS_FILE, JSON.stringify({ codes }, null, 2));
        await saveProgress(progress);

      } catch {
        logStep("collector", `⚠️ Skipping ${currentId} (timeout/error)`);
      }
    }
  } finally {
    await browser.close();
  }

  logStep("collector", `🎉 Done. Total collected: ${collectedCount}`);
}

if (require.main === module) {
  collectPrintableIds();
}
