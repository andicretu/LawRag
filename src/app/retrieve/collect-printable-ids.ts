// collect-printable-ids.ts
import puppeteer from "puppeteer";
import type { Page } from "puppeteer";
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
const END_ID = 200000;

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
  stopRequested = false;   
  console.log("Press 'Q' at any time to stop collecting.");

  await mkdir(OUTPUT_DIR, { recursive: true });

  // Connect to PostgreSQL
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Get the last recorded id from db
  const { rows: latestRows } = await client.query('SELECT detalii_id FROM printable_ids ORDER BY collected_at DESC LIMIT 1;');
  const lastCollectedId = latestRows[0]?.detalii_id ?? START_ID - 1;

  // Get the records count from db
  const { rows: countRows } = await client.query('SELECT COUNT(*) FROM printable_ids;');
  const collectedCount = Number(countRows[0]?.count ?? 0);

  if (isNaN(lastCollectedId)) {
    logStep("collector", `Invalid lastCollectedId in progress file. Resetting to ${START_ID - 1}`);
  }

  const skippedIds = await loadSkipped();

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

        let title = "";
        // collect titlu
        try {
            title = await page.$eval('h2.titlu_document', el => el.textContent?.trim() ?? "");
            console.log("🔍 TitleOld:", title);
        } catch {
          try {
            title = await page.$eval('span.S_DEN', el => el.textContent?.trim() ?? "");
            console.log("🔍 TitleNew:", title);
          } catch {
            console.log(`⚠️ Warning: Could not extract title for ID ${currentId} in both new and old formats`);
          }
        }
        
        //call extract publication date
        let publicationDate: string | null = null;
        try {
          publicationDate = await extractPublicationDate(page);
        } catch (err) {
          console.log(`⚠️ Warning: Could not extract publication date for ID ${currentId}`, err);
        }

        let detectedType: string | null = null;
        try {
          detectedType = detectDocumentType(title);
        } catch (err) {
          console.log(`⚠️ Warning: Could not detect document type for ID ${currentId}`, err);
        }

        //collect emitent
        let emitent: string | null = null;
        try {
          emitent = await page.evaluate(() => {
            const rows = document.querySelectorAll('#metaDocument table tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td');
              if (cells.length >= 2 && cells[0].textContent?.toLowerCase().includes('emitent')) {
                return cells[1].textContent?.trim() ?? null;
              }
            }
            // search "emitent" in old page structure
            const oldEmitentTitle = document.querySelector('table.S_EMT .S_EMT_TTL');
            const oldEmitentBody = document.querySelector('table.S_EMT .S_EMT_BDY li');
            if (oldEmitentTitle && oldEmitentBody && oldEmitentTitle.textContent?.toLowerCase().includes('emitent')) {
              return oldEmitentBody.textContent?.trim() ?? null;
            }
            return null;
          });
        } catch (err) {
          console.log(`⚠️ Warning: Could not extract emitent for ID ${currentId}`, err);
        }

        if (!title && !emitent) {
          console.log(`⚠️ ID ${currentId} has no title or emitent. Setting domain to unknown.`);
        }
        
        // Always classify domain even if missing
        const domainArray = classifyDomain(title, emitent);
        console.log("🔍 DEBUG: Current ID", currentId);
        console.log("🔍 DEBUG: Domain Array", domainArray);
        console.log("🔍 Printable Code:", code);
        console.log("🔍 Title:", title);
        console.log("🔍 Emitent:", emitent) ;
        
        // Insert to DB if found
        if (code) {
          const res = await client.query(
            `INSERT INTO printable_ids (detalii_id, printable_code, domain)
             VALUES ($1, $2, $3) ON CONFLICT (detalii_id) DO UPDATE SET domain = EXCLUDED.domain`,
            [currentId, code, domainArray]
          );
          
          // Insert into documents
          try {
            await client.query(
              `INSERT INTO documents (source_id, code, title, type, emitent, publication_date, domain, url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (source_id) DO UPDATE 
               SET title = EXCLUDED.title, type = EXCLUDED.type, emitent = EXCLUDED.emitent, publication_date = EXCLUDED.publication_date, domain = EXCLUDED.domain, url = EXCLUDED.url`,
              [currentId.toString(), code, title, detectedType, emitent, publicationDate, domainArray, url]
            );
          } catch (err) {
            console.log(`❌ Failed to insert into documents for ID ${currentId}:`, err);
          }

          if (res.rowCount! > 0) {
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
      } catch {
        // Handle timeouts and other navigation errors
        logStep("collector", `Skipping ${currentId} (timeout/error), added to skipped list`);
        skippedIds.push(currentId);
        await saveSkipped(skippedIds);
      }
      
    }
  } finally {
    // Cleanup: close browser and DB connection
    const { rows: updatedCountRows } = await client.query('SELECT COUNT(*) FROM printable_ids;');
    const updatedCollectedCount = Number(updatedCountRows[0]?.count ?? 0);

    logStep("collector", `Done. Total collected: ${updatedCollectedCount}`);

    await browser.close();
    await client.end();
  }
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

  await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('.fisa_act_chk');
    checkboxes.forEach(cb => {
      if (!(cb as HTMLInputElement).checked) {
        (cb as HTMLInputElement).click();
      }
    });
  });

  // New Step: wait for tables to appear
  await page.waitForSelector('#actiuni_suferite table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#actiuni_induse table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#refera_pe table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#referit_de table', { timeout: 5000 }).catch(() => {});


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
