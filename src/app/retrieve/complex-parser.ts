// retrieve/complex-parser.ts
import puppeteer from "puppeteer";
import { Client } from "pg";
import { logStep } from "../loader-console";

const SPAN_SELECTOR = "span";
const LEVEL_MAP: Record<string, string> = {
  S_TITLU: "titlu",
  S_CARTE_TTL: "carte",
  S_CAP_TTL: "capitol",
  S_SEC_TTL: "sectiune",
  S_ART_TTL: "articol",
  S_ART_BDY: "alineat",
  S_LIT_BDY: "litera",
  S_SUB_BDY: "subpunct",
  S_ANEXA_TTL: "anexa",
  S_PAR: "nota",
  S_DEN: "denumire",
  S_PUB: "publicare",
  S_PUB_BDY: "publicare",
  S_PUB_TTL: "publicare",
};

export async function parsePrintablePage(documentId: number, printableCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://legislatie.just.ro/Public/FormaPrintabila/${printableCode}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const spans = await page.$$eval(SPAN_SELECTOR, elements => {
    return elements.map(el => ({
      className: el.className,
      text: el.textContent?.trim() || ""
    }));
  });

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let parentStack: number[] = [];
  let currentSort = 0;

  for (const { className, text } of spans) {
    if (!text || !className) continue;
  
    const classes = className.split(" ");
    const matchedClass = classes.find(cls => LEVEL_MAP[cls]);
    
    let level = matchedClass ? LEVEL_MAP[matchedClass] : "nota"; // fallback to 'nota'
  
    // Special case: if text looks like an annex, force level to 'anexa'
    if (level === "nota" && text.toUpperCase().startsWith("ANEXA")) {
      level = "anexa";
    }
  
    const label = extractLabel(text);
    const content = extractContent(text);
  
    const parentId = parentStack[parentStack.length - 1] ?? null;
  
    const result = await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [documentId, parentId, level, label, content, currentSort++]
    );
  
    const insertedId = result.rows[0].id;
  
    // Maintain hierarchy stack for nesting (e.g., TITLU > CAPITOL > ARTICOL)
    if (["titlu", "carte", "capitol", "sectiune", "articol"].includes(level)) {
      parentStack.push(insertedId);
    }
  
    // If a new major top-level starts (Titlu, Capitol, Carte) -> reset deeper levels
    if (["titlu", "capitol", "carte"].includes(level)) {
      parentStack = parentStack.slice(0, 1);
    }
  }
  
  logStep("parser", `✅ Parsed and saved nodes for document ${documentId}`);
  await browser.close();
  await client.end();
}  

function extractLabel(text: string): string | null {
  const match = text.match(/^(Art\.\s*\d+|Capitolul\s+\w+|Titlul\s+\w+|CARTEA\s+\w+|Sec\S*\s+\d+|Anexa\s+\w+)/i);
  return match ? match[0] : null;
}

function extractContent(text: string): string {
  return text.trim();
}
