// retrieve/complex-parser.ts
import puppeteer from "puppeteer";
import { Client } from "pg";
import { logStep } from "../loader-console";

const SPAN_SELECTOR = "span";

const LEVEL_MAP: Record<string, NodeLevel> = {
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
  S_PUB_TTL: "publicare",
  S_PUB_BDY: "publicare"
};

const LEVEL_PRIORITY: Record<NodeLevel, number> = {
  denumire: 0,
  titlu: 1,
  carte: 2,
  capitol: 3,
  sectiune: 4,
  articol: 5,
  alineat: 6,
  litera: 7,
  subpunct: 8,
  anexa: 9,
  nota: 10,
  publicare: 11,
  prefata: 12
};

type NodeLevel =
  | "denumire" | "titlu" | "carte" | "capitol" | "sectiune"
  | "articol" | "alineat" | "litera" | "subpunct" | "anexa"
  | "nota" | "publicare" | "prefata";

type StackEntry = { id: number; level: NodeLevel };

export async function parsePrintablePage(documentId: number, printableCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://legislatie.just.ro/Public/FormaPrintabila/${printableCode}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const spans = await page.$$eval(SPAN_SELECTOR, elements =>
    elements.map(el => ({
      className: el.className,
      text: el.textContent?.trim() || ""
    }))
  );

  const seen = new Set<string>();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const parentStack: StackEntry[] = [];
  let currentSort = 0;

  for (const { className, text } of spans) {
    if (!text || seen.has(text)) continue;
    seen.add(text);

    const classes = className.split(" ");
    const matchedClass = classes.find(cls => LEVEL_MAP[cls]);
    let level: NodeLevel = matchedClass ? LEVEL_MAP[matchedClass] : "nota";

    const upper = text.toUpperCase();
    if (level === "nota" && upper.startsWith("ANEXA")) level = "anexa";
    if (level === "nota" && upper.startsWith("CAPITOLUL")) level = "capitol";
    if (level === "nota" && upper.startsWith("TITLUL")) level = "titlu";
    if (level === "nota" && upper.startsWith("CARTEA")) level = "carte";
    if (level === "nota" && upper.match(/^ART(\.|ICOLUL)/)) level = "articol";

    const label = extractLabel(text);
    const content = extractContent(text, label);

    const myPriority = LEVEL_PRIORITY[level];

    while (parentStack.length > 0) {
      const top = parentStack[parentStack.length - 1];
      if (LEVEL_PRIORITY[top.level] < myPriority) break;
      parentStack.pop();
    }

    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

    const result = await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [documentId, parentId, level, label, content, currentSort++]
    );

    const insertedId = result.rows[0].id;

    // Push only structured levels
    if (["titlu", "carte", "capitol", "sectiune", "articol", "alineat", "litera", "subpunct"].includes(level)) {
      parentStack.push({ id: insertedId, level });
    }
  }

  logStep("parser", `✅ Parsed and saved nodes for document ${documentId}`);
  await browser.close();
  await client.end();
}

function extractLabel(text: string): string | null {
  const match = text.match(
    /^(Art\.?\s*\d+[^\s]*|Articolul\s+\d+[^\s]*|Capitolul\s+\w+|Titlul\s+\w+|CARTEA\s+\w+|Anexa\s+\w+)/i
  );
  return match ? match[0] : null;
}

function extractContent(text: string, label: string | null): string {
  return label ? text.replace(label, "").trim() : text.trim();
}
