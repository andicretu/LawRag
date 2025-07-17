// src/db/import-printable-ids.ts
import { readFile } from "fs/promises";
import path from "path";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function importPrintableIds() {
  const filePath = path.resolve(process.cwd(), "src/app/output/printable-ids.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);
  const entries: string[] = data.codes;

  await client.connect();

  for (const entry of entries) {
    const [detaliiId, printableCode] = entry.split(":");
    if (!detaliiId || !printableCode) continue;

    await client.query(
      `INSERT INTO printable_ids (detalii_id, printable_code)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [Number(detaliiId), printableCode]
    );
  }

  await client.end();
  console.log("✅ Import complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importPrintableIds();
}
