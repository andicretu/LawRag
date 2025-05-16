import puppeteer from "puppeteer";
import { Client } from "pg";
import { logStep } from "../loader-console";

// Define Class Categories
const LEVEL_CLASS = new Map([
  ["S_TTL", "titlu"],
  ["S_CRT", "carte"],
  ["S_CAP", "capitol"],
  ["S_ART", "articol"],
  ["S_POR", "parte"],
  ["S_PAR", "paragraf"],
  ["S_LIT", "litera"],
  ["S_ALN", "alineat"],
  ["S_NTA", "nota"],
  ["S_ANX", "anexa"],
  ["S_SMN", "semnatura"]
]);

const LEVEL_ORDER = ["titlu", "carte", "capitol", "articol", "parte", "anexa"];

const LABEL_CLASS = new Set([
  "S_CAP_TTL", "S_TTL_TTL", "S_CRT_TTL", "S_ART_TTL",
  "S_POR_TTL", "S_ANX_TTL", "S_NTA_TTL", "S_ALN_TTL", "S_BLC_TTL"
]);

const NAME_CLASS = new Set([
  "S_CAP_DEN", "S_TTL_DEN", "S_CRT_DEN", "S_ART_DEN",
  "S_POR_DEN", "S_ANX_DEN", "S_NTA_DEN", "S_ALN_DEN"
]);

const CONTENT_CLASS = new Set([
  "S_PAR", "S_LIT_BDY", "S_ALN_BDY", "A_PAR", "S_SMN_PAR"
]);

// Main function to parse the printable page
export async function parsePrintablePage(documentId: number, printableCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://legislatie.just.ro/Public/FormaPrintabila/${printableCode}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const spans = await page.$$eval("span", elements =>
    elements.map(el => ({
      className: el.className,
      text: el.textContent?.trim() || "",
    }))
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let currentSort = 0;
  const parentStack: { id: number; level: string; label: string }[] = [];

  for (let i = 0; i < spans.length; i++) {
    const { className, text } = spans[i];
    if (!text.trim()) continue;

    const classes = className.split(" ");

    // Prioritize content sections first
    if (classes.some(cls => CONTENT_CLASS.has(cls))) {
      await saveContentSection(documentId, classes, text, parentStack, client, currentSort++);
      continue; // Skip to next iteration to avoid treating it as structural
    }

    // Only save as structural if it is not a content section
    else if (classes.some(cls => LEVEL_CLASS.has(cls))) {
      await saveStructuralSection(documentId, classes, spans, i, parentStack, client, currentSort++);
    }

        // Fallback for unrecognized elements
    else if (text.trim()) {
      await saveUnrecognizedSection(documentId, text, parentStack, client, currentSort++);
      logStep("parser", `⚠️ Saved Unrecognized Section as S_PAR: ${text}`);
    }
  }

  await browser.close();
  await client.end();
}

// Function to save structural sections (Capitol, Articol, etc.)
async function saveStructuralSection(
  documentId: number, 
  classes: string[], 
  spans: { className: string, text: string }[], 
  index: number, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {
  const matchedLevel = classes.find(cls => LEVEL_CLASS.has(cls));
  if (!matchedLevel) return;

  const level = LEVEL_CLASS.get(matchedLevel)!;
  let label = spans[index].text.trim();

  // Build the complete label
  for (let j = index + 1; j < spans.length; j++) {
    const subClasses = spans[j].className.split(" ");

    if (LABEL_CLASS.has(subClasses[0])) {
      label = spans[j].text.trim();
    } else if (NAME_CLASS.has(subClasses[0])) {
      label += label ? ` - ${spans[j].text.trim()}` : "";
      index = j;
      break;
    }

    if (LEVEL_CLASS.has(subClasses[0]) || CONTENT_CLASS.has(subClasses[0])) {
      break;
    }
  }

  const parentId = getParentId(level, parentStack);

  const result = await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, $3, $4, 'nc', $5, $6) RETURNING id`,
    [documentId, parentId, level, label, sortOrder, matchedLevel]
  );

  parentStack.push({ id: result.rows[0].id, level, label });
  logStep("parser", `✅ Saved Structural Section: ${level} with label: ${label} (Source: ${matchedLevel})`);
}

// Function to save content sections (paragraf, litera, etc.)
async function saveContentSection(
  documentId: number, 
  classes: string[], 
  text: string, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {
  if (parentStack.length === 0) {
    logStep("parser", `❌ Error: Content section with no parent. Skipping.`);
    return;
  }

  const parent = parentStack[parentStack.length - 1];
  const contentLevel = LEVEL_CLASS.get(classes.find(cls => CONTENT_CLASS.has(cls))!) || "paragraf";

  await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, $3, 'content', $4, $5, $6)`,
    [documentId, parent.id, contentLevel, text.trim() || "nc", sortOrder, classes.join(" ")]
  );

  logStep("parser", `✅ Saved Content Section: ${contentLevel} under ${parent.level} - ${parent.label}`);
}

// Function to determine the correct parent
function getParentId(
  level: string, 
  parentStack: { id: number; level: string; label: string }[]
): number | null {
  for (let p = parentStack.length - 1; p >= 0; p--) {
    const parentLevel = parentStack[p].level;
    if (LEVEL_ORDER.indexOf(parentLevel) < LEVEL_ORDER.indexOf(level)) {
      return parentStack[p].id;
    }
  }
  return null;
}

// Function to save unrecognized sections as S_PAR
async function saveUnrecognizedSection(
  documentId: number, 
  text: string, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {
  if (parentStack.length === 0) {
    logStep("parser", `⚠️ No parent found for unrecognized section. Saving as top-level section.`);

    await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
       VALUES ($1, NULL, 'paragraf', 'content', $2, $3, 'S_PAR')`,
      [documentId, text.trim(), sortOrder]
    );
    return;
  }
}