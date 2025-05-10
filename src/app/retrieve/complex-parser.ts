import puppeteer from "puppeteer";
import { Client } from "pg";
import { logStep } from "../loader-console";

const SPAN_SELECTOR = "span";

const LEVEL_MAP: Record<string, NodeLevel> = {
  S_TITLU: "titlu",
  S_CARTE: "carte",
  S_CAP: "capitol",
  S_POR: "sectiune",
  S_ART: "articol",
  S_ANEXA: "anexa",
  S_DEN: "denumire",
  S_HDR: "descriere",
  S_EMT: "emitent",
  S_PUB: "publicare"
};

type NodeLevel =
  | "denumire"      // Document name and issuing date
  | "descriere"     // Header or description
  | "emitent"       // Issuing institution
  | "publicare"     // Publication date
  | "carte"         // Book or main section
  | "titlu"         // Title
  | "capitol"       // Chapter, main structural section
  | "sectiune"      // Section (sub-division within a chapter)
  | "articol"       // Article, main text section
  | "anexa"         // Annex, additional document
  | "nota";         // Note, catch-all for unrecognized sections

export async function parsePrintablePage(documentId: number, printableCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://legislatie.just.ro/Public/FormaPrintabila/${printableCode}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const spans = await page.$$eval(SPAN_SELECTOR, elements =>
    elements.map(el => ({
      className: el.className,
      text: el.textContent?.trim() || "",
      outerHTML: el.outerHTML
    }))
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let currentSort = 0;

  let currentContent = ""; // Accumulates content for each main section
  let currentLevel: NodeLevel | null = null;

  for (const { className, text } of spans) {
    const trimmedText = text.trim();
    if (!trimmedText || /^\s*$/.test(trimmedText)) continue;

    const classes = className.split(" ");
    const matchedClass = classes.find(cls => LEVEL_MAP[cls]);
    const level: NodeLevel = matchedClass ? LEVEL_MAP[matchedClass] : "nota";

    if (level !== currentLevel) {
      // Save the previous section if it exists
      if (currentLevel && currentContent.trim()) {
        await client.query(
          `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, section_type, source_class)
           VALUES ($1, NULL, $2, NULL, $3, $4, NULL, $5)`,
          [documentId, currentLevel, currentContent.trim(), currentSort++, 'main_section']
        );
      }

      // Reset for the new section
      currentLevel = level;
      currentContent = "";
    }

    // Accumulate text for the current main section
    currentContent += " " + trimmedText;
  }

  // Save the final accumulated section
  if (currentLevel && currentContent.trim()) {
    await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, section_type, source_class)
       VALUES ($1, NULL, $2, NULL, $3, $4, NULL, 'main_section')`,
      [documentId, currentLevel, currentContent.trim(), currentSort++]
    );
  }

  logStep("parser", `✅ Parsed and saved nodes for document ${documentId}`);
  await browser.close();
  await client.end();
}
