// loader-console.ts

import { config } from "dotenv";
import readline from "readline/promises";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from "path";
import { Client } from "pg";
import { collectPrintableIds } from "./retrieve/collect-printable-ids";
import { parsePrintablePage } from "./retrieve/complex-parser";
import { chunkLaws } from "./retrieve/chunk-laws";
import { embedChunksDb } from "./augment/embed-chunks-db";
import { fetchFromApi, SearchCriteria } from './retrieve/api-fetch-documents';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });
// sanity check
const LAST_DOCUMENT = 284503;
let stopParsing = false;
let stopCollecting = false;
let stopFetching = false;
let stopChunking = false;


async function startParsing() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // 1) Find the last successfully parsed document_id in nodes
  const { rows: parsedRows } = await client.query< { last_parsed: number | null } >(`
    SELECT MIN(document_id) AS last_parsed
      FROM nodes
  `);
  const lastParsed = parsedRows[0].last_parsed;
  // 2) If nothing parsed yet, default to 284503
  const startAt = lastParsed ?? LAST_DOCUMENT;

  // Reset parsed column for documents from startAt downward (new run), and reset the "parsed" column
  
  if (startAt === LAST_DOCUMENT) {
    await client.query(
      `UPDATE documents SET parsed = NULL WHERE id <= $1`,
      [startAt]
    );
    console.log(`♻️ Reset 'parsed' column to NULL for documents with ID <= ${startAt}`);
  }

  console.log(`🔄 Resuming parse at ID = ${startAt}`);

  // 3) Grab every remaining document ≤ startAt, in descending order
  const { rows } = await client.query<{ id: number; code: string }>(
    `
    SELECT id, code
    FROM documents
    WHERE id <= $1
    ORDER BY id DESC
    `,
    [startAt]
  );

  for (const { id, code } of rows) {
    if (stopParsing) {
      console.log("\n❌ Parsing stopped by user.");
      break;
    }
    try {
      await parsePrintablePage(id, code);
      await client.query(`UPDATE documents SET parsed = true WHERE id = $1`, [id]);
      console.log(`✅ Parsed document: ID = ${id}`);
    } catch (err) {
      await client.query(`UPDATE documents SET parsed = false WHERE id = $1`, [id]);
      console.error(`❌ Failed to parse ID = ${id}. Marked as parsed = false.`, err);
    }    
  }
  await client.end();
}

process.on("SIGINT", () => {
  console.log("\n🔴 Interrupt signal received. Stopping...");
  stopParsing = true;
  stopCollecting = !stopCollecting;
  stopFetching = !stopFetching;
  stopChunking = !stopChunking;
});

async function displayStatus() {

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query('SELECT MIN(detalii_id) AS start_id, MAX(detalii_id) AS end_id, COUNT(*) AS total_count FROM printable_ids;');
  const { start_id, end_id, total_count } = rows[0] || {};

  await client.end();

  console.log("\n Current Document Load Status:");
  console.log(`🔍 Collector: Start ID = ${start_id || "-"}, Last ID = ${end_id || "-"}, Count = ${total_count || 0}`);

}

export function logStep(step: string, message: string) {
  const label = step.padEnd(10, " ");
  console.log(`[${label}] ${message}`);
}

async function startCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    await displayStatus();
    const command = await rl.question("👉 Command (collect | parse | chunk | embed | exit): ");

    if (command === "collect") {
      await collectPrintableIds();
      stopCollecting = false;
    } else if (command === "chunk") {
        stopChunking = false;
        try {
          await chunkLaws(() => stopChunking);
        } catch (err) {
          console.error('❌ Error during chunking:', err instanceof Error ? err.message : err);
        } 
    } else if (command === "embed") {
        await embedChunksDb();
    } else if (command === "parse") {
        stopParsing = false; // Reset stop flag before parsing
        await startParsing();
    } else if (command === "status") {
        await displayStatus();
    } else if (command === 'fetch') {
      // Define your search criteria. Adjust fields as per the WSDL schema.
        const criteria: SearchCriteria = {
      };
      try {  
        console.log('🔄 Fetching documents...');
        await fetchFromApi(criteria);
        console.log('✅ Fetch complete');
      } catch (err) {
        console.error('❌ Error during fetch:', err instanceof Error ? err.message : err);
      }
      stopFetching = false;
    } else if (command === "exit") {
        console.log("👋 Exiting CLI.");
        rl.close();
        break;
    } else {
        console.log("❓ Unknown command.");
    }
  }
}

startCLI();
