// collect-printable-ids.ts
import puppeteer from "puppeteer";
import type { Page } from "puppeteer";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { logStep } from "../loader-console";
import { Client } from "pg";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables from .env file
dotenv.config();

// Define output directory and progress file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, "../output");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "operations-progress.json");

// Setup flag to allow user to interrupt collection with 'Q'
let stopRequested = false;

// Enable keypress listening for manual quit
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (str, key) => {
    if (key.name === "q" || key.name === "Q") {
      console.log("Quit requested. Finishing current loop...");
      stopRequested = true;
    }
  });
}

// Set document ID range
const START_ID = 2;
const END_ID = 200000;

// Helper to check if a file exists
async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Type definition for tracking progress
type ProgressData = {
  collector?: {
    lastCollectedId: number;
    collectedCount: number;
  };
  scraper?: unknown;
  chunker?: unknown;
  embedder?: unknown;
};

// Load previous progress state from file
async function loadProgress(): Promise<ProgressData> {
  if (await exists(PROGRESS_FILE)) {
    const raw = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  }
  return {};
}

// Save current progress state to file
async function saveProgress(progress: ProgressData): Promise<void> {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Define path to skipped IDs file
const skippedPath = path.join(OUTPUT_DIR, "skipped-ids.json");

// Load previously skipped IDs
async function loadSkipped(): Promise<number[]> {
  try {
    const raw = await readFile(skippedPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save skipped IDs to disk,unique and ordered
async function saveSkipped(skippedIds: number[]) {
  const unique = Array.from(new Set(skippedIds)).sort((a, b) => a - b);
  await writeFile(skippedPath, JSON.stringify(unique, null, 2));
}

// Define path to references-stubs file
const referencesPath = path.join(OUTPUT_DIR, "references-stub.json");

// Load previously collected references
async function loadReferenceStubs(): Promise<ReferenceStub[]> {
  try {
    const raw = await readFile(referencesPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save newly collected references
async function saveReferenceStubs(stubs: ReferenceStub[]) {
  const unique = Array.from(
    new Map(stubs.map((s) => [`${s.sourceDetaliiId}|${s.referenceType}|${s.targetCodeText}|${s.sectionLabel}`, s]))
  ).map(([, v]) => v);
  await writeFile(referencesPath, JSON.stringify(unique, null, 2));
}

// Main function that collects printable law document IDs
export async function collectPrintableIds() {
  console.log("Press 'Q' at any time to stop collecting.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Load progress and initialize if missing
  const progress = await loadProgress();
  if (!progress.collector) {
    progress.collector = { lastCollectedId: START_ID - 1, collectedCount: 0 };
  }

  const lastCollectedId = Number(progress.collector?.lastCollectedId ?? START_ID - 1);
  let collectedCount = Number(progress.collector?.collectedCount ?? 0);

  if (isNaN(lastCollectedId)) {
    logStep("collector", `Invalid lastCollectedId in progress file. Resetting to ${START_ID - 1}`);
  }

  const skippedIds = await loadSkipped();

  // Connect to PostgreSQL
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  logStep("collector", `Starting from ID ${lastCollectedId + 1}, collected so far: ${collectedCount}`);

  try {
    for (let currentId = lastCollectedId + 1;
      currentId <= END_ID && !stopRequested;
      currentId++) {

      const url = `http://legislatie.just.ro/Public/DetaliiDocument/${currentId}`;

      try {
        // Attempt to navigate to the target page
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 5000 });

        if (!response || !response.ok()) {
          logStep("collector", `HTTP error ${response?.status()} at ID ${currentId}`);
          continue;
        }

        // Extract printable code from link
        const code = await page.evaluate(() => {
          const a = document.querySelector('a[href*="FormaPrintabila"]');
          return a ? a.getAttribute("href")?.split("/").pop() : null;
        });

        // Insert to DB if found
        if (code) {
          const res = await client.query(
            `INSERT INTO printable_ids (detalii_id, printable_code)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [currentId, code]
          );

          if (res.rowCount! > 0) {
            collectedCount++;
            logStep("collector", `Inserted: ${currentId}:${code}`);
          } else {
            logStep("collector", `Skipped ${currentId} (already in DB)`);
          }
        } else {
          logStep("collector", `Skipping ${currentId} (no printable code)`);
        }
        
        //extract references and save to JSON
        const newStubs = await extractReferencesFromPage(page, currentId);
        if (newStubs.length > 0) {
          const existingStubs = await loadReferenceStubs();
          await saveReferenceStubs([...existingStubs, ...newStubs]);
          logStep("collector", `Found ${newStubs.length} references for ID ${currentId}`);
        }

        // Update progress
        progress.collector = { lastCollectedId: currentId, collectedCount };
        await saveProgress(progress);

      } catch {
        // Handle timeouts and other navigation errors
        logStep("collector", `Skipping ${currentId} (timeout/error), added to skipped list`);
        skippedIds.push(currentId);
        await saveSkipped(skippedIds);
      }
    }
  } finally {
    // Cleanup: close browser and DB connection
    await browser.close();
    await client.end();
  }

  logStep("collector", `Done. Total collected: ${collectedCount}`);
}

//define references structure
export type ReferenceStub = {
  sourceDetaliiId: number;
  referenceType: string;
  targetCodeText: string;
  sectionLabel: string | null;
};

//extarct references from document page
export async function extractReferencesFromPage(
  page: Page,
  detaliiId: number
): Promise<ReferenceStub[]> {
  const references: ReferenceStub[] = await page.evaluate((detaliiId) => {
    const rawRefs: {
      sourceDetaliiId: number;
      referenceType: string;
      targetCodeText: string;
      sectionLabel: string | null;
    }[] = [];

    const typeMap: Record<string, string> = {
      "MODIFICAT DE": "is_modified_by",
      "COMPLETAT DE": "is_completed_by",
      "ABROGAT DE": "is_abrogated_by",
      "ABROGA": "abrogates",
      "REFERA PE": "refers_to",
      "REFERIT DE": "is_referred_by",
      "ACTUALIZEAZA PE": "updates",
      "SUSPENDAT DE": "is_suspended_by",
      "SUSPENDA": "suspends",
      "RECTIFICAT DE": "is_corrected_by",
      "RECTIFICA": "corrects",
      "ARE LEGATURA CU": "refers_to",
      "REFERIRE LA": "refers_to"
    };

    const clean = (text: string | null) =>
      text?.replace(/\s+/g, " ").trim() ?? "";

    document.querySelectorAll("table tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) return;

      const section = clean(cells[0]?.textContent);
      const rawType = clean(cells[1]?.textContent);
      const targetCodeText = clean(cells[2]?.textContent);

      const normalizedType = typeMap[rawType];
      if (!normalizedType || !targetCodeText) return;

      rawRefs.push({
        sourceDetaliiId: detaliiId,
        referenceType: normalizedType,
        targetCodeText,
        sectionLabel: section || null
      });
    });

    return rawRefs;
  }, detaliiId);

  return references;
}

// Only run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPrintableIds();
}
