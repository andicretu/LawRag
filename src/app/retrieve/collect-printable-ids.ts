// collect-printable-ids.ts
import puppeteer from "puppeteer";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { logStep } from "../loader-console";
import { Client } from "pg";
import dotenv from "dotenv";
import readline from "readline";
import { classifyDomain } from "../domain/classifyDomain";
import { extractPublicationDate } from "./extract-publication-date";
import { detectDocumentType } from "./detect-document-type";
import { collectAndSaveReferences } from "./references-collector"; // Importing the reference collector

// Load environment variables from .env file
dotenv.config();

// Define output directory and progress file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, "../output");

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
const END_ID = 297064;

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

// Save skipped IDs to disk, unique and ordered
async function saveSkipped(skippedIds: number[]) {
  const unique = Array.from(new Set(skippedIds)).sort((a, b) => a - b);
  await writeFile(skippedPath, JSON.stringify(unique, null, 2));
}

// Main function that collects printable law document IDs
export async function collectPrintableIds() {
  stopRequested = false;   
  console.log("Press 'Q' at any time to stop collecting.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Connect to PostgreSQL
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Get the last recorded id from db
  const { rows: latestRows } = await client.query('SELECT detalii_id FROM printable_ids ORDER BY collected_at DESC LIMIT 1;');
  const lastCollectedId = latestRows[0]?.detalii_id ?? START_ID - 1;
  const skippedIds = await loadSkipped();

  // Launch Puppeteer browser
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  logStep("collector", `Starting from ID ${lastCollectedId + 1}`);

  try {
    for (let currentId = lastCollectedId + 1;
      currentId <= END_ID && !stopRequested;
      currentId++) {

      const url = `http://legislatie.just.ro/Public/DetaliiDocument/${currentId}`;
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });

        if (!response || !response.ok()) {
          logStep("collector", `HTTP error ${response?.status()} at ID ${currentId}`);
          continue;
        }

        // Extract printable code from link
        const code = await page.evaluate(() => {
          const a = document.querySelector('a[href*="FormaPrintabila"]');
          return a ? a.getAttribute("href")?.split("/").pop() : null;
        });

        if (!code) {
          logStep("collector", `Skipping ${currentId} (no printable code)`);
          continue;
        }

        // Collect title, emitent, and publication date
        const title = await page.$eval('h2.titlu_document, span.S_DEN', el => el.textContent?.trim() ?? "") || "Unknown";
        const publicationDate = await extractPublicationDate(page);

        const emitent = await page.evaluate(() => {
          // Try new format
          const cells = Array.from(document.querySelectorAll('#metaDocument table tr td'));
          const emitentCell = cells.find(cell => cell.textContent?.toLowerCase().includes("emitent"));
          if (emitentCell) {
            return emitentCell?.nextElementSibling?.textContent?.trim() ?? "Unknown";
          }

          // Try old format
          const oldEmitentTitle = document.querySelector('table.S_EMT .S_EMT_TTL');
          const oldEmitentBody = document.querySelector('table.S_EMT .S_EMT_BDY li');
          if (oldEmitentTitle && oldEmitentBody && oldEmitentTitle.textContent?.toLowerCase().includes('emitent')) {
            return oldEmitentBody.textContent?.trim() ?? "Unknown";
          }

          // Try alternative selectors (if any other format exists)
          const alternativeEmitent = document.querySelector('.emitent-class-selector'); // Adjust this selector if any other exists
          if (alternativeEmitent) {
            return alternativeEmitent.textContent?.trim() ?? "Unknown";
          }

          return "Unknown";
        });

        const detectedType = detectDocumentType(title, emitent);
        const domainArray = classifyDomain(title, emitent);

        // Logging domain and emitent
        console.log(`Document ID: ${currentId}`);
        console.log(`Domain: ${JSON.stringify(domainArray)}`);
        console.log(`Emitent: ${emitent}`);
        console.log(`Title: ${title}`);
        console.log(`Publication Date: ${publicationDate}`);

        // Save the printable document info
        await client.query(
          `INSERT INTO printable_ids (detalii_id, printable_code, domain)
           VALUES ($1, $2, $3) ON CONFLICT (detalii_id) DO NOTHING`,
          [currentId, code, domainArray]
        );

        await client.query(
          `INSERT INTO documents (source_id, code, title, type, emitent, publication_date, domain, url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (source_id) DO NOTHING`,
          [currentId, code, title, detectedType, emitent, publicationDate, domainArray, url]
        );

        logStep("collector", `Inserted: ${currentId}:${code}`);

        // Collect and save references for this document
        await collectAndSaveReferences(page, currentId);
        console.log(`References collected for document ${currentId}`);
        console.log(`\n`);

      } catch (err) {
        logStep("collector", `Skipping ${currentId} (error), added to skipped list`);
        console.error(`❌ Error at ID ${currentId}:`, err);
        skippedIds.push(currentId);
        await saveSkipped(skippedIds);
      }      
    }
  } finally {
    await browser.close();
    await client.end();
    logStep("collector", "Collection process completed.");
  }
}

// Only run if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPrintableIds();
}
