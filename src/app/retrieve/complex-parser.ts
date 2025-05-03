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
  S_ANEXA_TTL: "anexa",
  S_PAR: "nota",
  S_LIT_BDY: "litera",
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

const CONTAINER_ONLY_CLASSES = new Set([
  "S_ART", "S_CAP", "S_CAP_BDY", "S_CARTE", "S_SEC"
]);

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

  const seen = new Set<string>();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const parentStack: StackEntry[] = [];
  let currentSort = 0;
  let currentArticleId: number | null = null;
  let insideArtBody = false;
  let lastLiteraLabel: string | null = null;

  for (const { className, text } of spans) {
    const trimmedText = text.trim();
    if (!trimmedText || /^\s*$/.test(trimmedText)) continue;

    const classes = className.split(" ");
    if (classes.some(cls => CONTAINER_ONLY_CLASSES.has(cls))) continue;

    const matchedClass = classes.find(cls => LEVEL_MAP[cls]);
    let level: NodeLevel = matchedClass ? LEVEL_MAP[matchedClass] : "nota";
    const upper = trimmedText.toUpperCase();

    if (level === "nota" && upper.startsWith("ANEXA")) level = "anexa";
    if (level === "nota" && upper.startsWith("CAPITOLUL")) level = "capitol";
    if (level === "nota" && upper.startsWith("TITLUL")) level = "titlu";
    if (level === "nota" && upper.startsWith("CARTEA")) level = "carte";
    if (level === "nota" && upper.match(/^ART(\.|ICOLUL)/)) level = "articol";

    if (classes.includes("S_ART_BDY")) {
      insideArtBody = true;
      continue;
    }

    if (insideArtBody && LEVEL_PRIORITY[level] <= LEVEL_PRIORITY["articol"]) {
      insideArtBody = false;
    }

    const label = extractLabel(trimmedText);
    const content = extractContent(trimmedText, label);
    const sourceClass = className;

    if (insideArtBody && currentArticleId !== null) {
      if (classes.includes("S_PAR")) {
        const uniqueKey = `${currentArticleId}:alineat:${label}:${content}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        await client.query(
          `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
           VALUES ($1, $2, 'alineat', $3, $4, $5, $6)`,
          [documentId, currentArticleId, label, content, currentSort++, sourceClass]
        );
        continue;
      }

      if (classes.includes("S_LIT_TTL")) {
        lastLiteraLabel = extractLabel(trimmedText);
        continue;
      }

      if (classes.includes("S_LIT_BDY") && lastLiteraLabel !== null) {
        const literaContent = extractContent(trimmedText, lastLiteraLabel);
        const uniqueKey = `${currentArticleId}:litera:${lastLiteraLabel}:${literaContent}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        await client.query(
          `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
           VALUES ($1, $2, 'litera', $3, $4, $5, $6)`,
          [documentId, currentArticleId, lastLiteraLabel, literaContent, currentSort++, sourceClass]
        );
        lastLiteraLabel = null;
        continue;
      }

      if (classes.includes("S_LIT") || classes.includes("S_LIT_SHORT")) continue;
    }

    const dedupKey = `${level}:${label}:${content}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const myPriority = LEVEL_PRIORITY[level];
    while (parentStack.length > 0) {
      const top = parentStack[parentStack.length - 1];
      if (LEVEL_PRIORITY[top.level] < myPriority) break;
      parentStack.pop();
    }

    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;

    const result = await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [documentId, parentId, level, label, content, currentSort++, sourceClass]
    );

    const insertedId = result.rows[0].id;
    if (level === "articol") currentArticleId = insertedId;

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
    /^(Art\.?\s*\d+[^\s]*|Articolul\s+\d+[^\s]*|Capitolul\s+\w+|Titlul\s+\w+|CARTEA\s+\w+|Anexa\s+\w+|\(\d+\)|[a-z]\))/i
  );
  return match ? match[0] : null;
}

function extractContent(text: string, label: string | null): string {
  return label ? text.replace(label, "").trim() : text.trim();
}
