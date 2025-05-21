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
  ["S_ALN", "alineat"],
  ["S_ANX", "anexa"],
  ["S_SMN", "semnatura"]
]);

const LEVEL_ORDER = ["titlu", "carte", "capitol", "articol", "parte", "anexa"];

const HEADER_CLASS = new Set([
  "S_DEN", "S_HDR", "S_EMT_TTL", "S_EMT_BDY", "S_PUB"
]);

const CONTAINER_CLASS = new Set([
  "S_TTL_BDY", "S_CRT_BDY", "S_CAP_BDY", "S_ART_BDY", "S_POR_BDY",
  "S_ANX_BDY", "S_SMN_BDY", "S_NTA_BDY", "S_NTA_SHORT", "S_NTA", "S_PCT", "S_PCT_SHORT", "S_PCT_TTL", "S_ALN_BDY", "S_LIT_SHORT", "S_LIT_BDY", "S_LIT_TTL", "S_LIN_BDY", "S_LIN_TTL", "S_LIN_SHORT","A_ELEMENT_CENTER", "S_SMN_PAR", "S_PUB_TTL", "S_PUB_BDY", "S_BLC_BDY", "S_CIT"
]);


const LABEL_CLASS = new Set([
  "S_CAP_TTL", "S_TTL_TTL", "S_CRT_TTL", "S_ART_TTL",
  "S_POR_TTL", "S_ANX_TTL", "S_NTA_TTL", "S_ALN_TTL", "S_BLC_TTL"
]);

const NAME_CLASS = new Set([
  "S_CAP_DEN", "S_TTL_DEN", "S_CRT_DEN", "S_ART_DEN",
  "S_POR_DEN", "S_ANX_DEN", "S_NTA_DEN", "S_ALN_DEN"
]);

const CONTENT_CLASS = new Set([
  "S_PAR", "S_PCT_BDY", "S_LIT", "S_ALN", "A_PAR", "S_SMN", "S_LIN", "S_BLC", "S_NTA_PAR"
]);

const REFERENCE_CLASS = new Set([
  "S_REF"
]);

// Main function to parse the printable page
export async function parsePrintablePage(documentId: number, printableCode: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://legislatie.just.ro/Public/FormaPrintabila/${printableCode}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const spans = await page.$$eval("span", elements =>
    elements.map(el => {
      const anchor = el.querySelector("a");
      const href = anchor?.getAttribute("href") || null;

      return {
        className: el.className,
        text: el.textContent?.trim() || "",
        href
      };
    })
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let currentSort = 0;
  const parentStack: { id: number; level: string; label: string }[] = [];

  // Create a root node for the document (Title)
  const documentMetadata = await client.query(`SELECT title FROM documents WHERE id = $1`, [documentId]);
  const documentTitle = documentMetadata.rows[0]?.title || "Untitled Document";

  const rootResult =await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, NULL, 'metadata', $2, $2, $3, 'document_title') RETURNING id`,
    [documentId, documentTitle, currentSort++]
  );

  const rootId = rootResult.rows[0].id;
  parentStack.length = 0; // Ensure the stack is cleared
  parentStack.push({ id: rootId, level: "metadata", label: documentTitle });

  for (let i = 0; i < spans.length; i++) {
    const { className, text, href } = spans[i];
    if (!text.trim()) continue;

    const classes = className.split(" ");

        // Capture header content
    if (classes.some(cls => HEADER_CLASS.has(cls))) {
      await saveHeaderSection(documentId, classes, text, parentStack, client, currentSort++);
      continue;
    }

    // Prioritize content sections
    if (classes.some(cls => CONTENT_CLASS.has(cls))) {
      await saveContentSection(documentId, classes, text, parentStack, client, currentSort++);
      continue;
    }

    // Only save as structural if it is not a content section
    else if (classes.some(cls => LEVEL_CLASS.has(cls))) {
      await saveStructuralSection(documentId, classes, spans, i, parentStack, client, currentSort++);
    }

    // Skip container spans
    else if (classes.some(cls => CONTAINER_CLASS.has(cls))) {
      continue;
    }

    // Save references sections
    if (classes.some(cls => REFERENCE_CLASS.has(cls))) {
      await saveReferenceSection(documentId, classes, href, parentStack, client, currentSort++);
      continue;
    }
    
    // Fallback for unrecognized elements
    else if (text.trim() && !classes.some(cls => CONTENT_CLASS.has(cls) || LEVEL_CLASS.has(cls) || CONTAINER_CLASS.has(cls) || LABEL_CLASS.has(cls) || NAME_CLASS.has(cls))) {
      await saveUnrecognizedSection(documentId, text, className, parentStack, client, currentSort++);
    }
  }

  await browser.close();
  await client.end();
}

//Save header section
async function saveHeaderSection(
  documentId: number, 
  classes: string[], 
  text: string, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {

  const parent = parentStack[parentStack.length - 1];
  const contentLevel = LEVEL_CLASS.get(classes.find(cls => CONTENT_CLASS.has(cls))!) || "paragraf";

  await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, $3, 'header', $4, $5, $6)`,
    [documentId, parent.id, contentLevel, text.trim() || "nc", sortOrder, classes.join(" ")]
  );
}

function normalizeHref(href: string | null): string {
  if (!href) return "nc"; // fallback for null or empty

  // Remove leading "~/../../../" or other relative parts
  const cleanedPath = href.replace(/^~\/\.\.\/\.\.\/\.\.\/?/, "");

  // Prepend base URL
  return `https://legislatie.just.ro/${cleanedPath}`;
}


//Save reference section
async function saveReferenceSection(
  documentId: number, 
  classes: string[], 
  href: string | null, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {

  const parent = parentStack[parentStack.length - 1];
  const contentLevel = LEVEL_CLASS.get(classes.find(cls => CONTENT_CLASS.has(cls))!) || "paragraf";
  const normalizedUrl = normalizeHref(href);


  await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, $3, 'reference', $4, $5, $6)`,
    [documentId, parent.id, contentLevel, normalizedUrl || "nc", sortOrder, classes.join(" ")]
  );
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
     VALUES ($1, $2, $3, $4, $4, $5, $6) RETURNING id`,
    [documentId, parentId, level, label, sortOrder, matchedLevel]
  );

  parentStack.push({ id: result.rows[0].id, level, label });
  //logStep("parser", `✅ Saved Structural Section: ${level} with label: ${label} (Source: ${matchedLevel})`);
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

  const parent = parentStack[parentStack.length - 1];
  const contentLevel = LEVEL_CLASS.get(classes.find(cls => CONTENT_CLASS.has(cls))!) || "paragraf";

  await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, $3, 'content', $4, $5, $6)`,
    [documentId, parent.id, contentLevel, text.trim() || "nc", sortOrder, classes.join(" ")]
  );
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

// Function to save unrecognized sections as it is found
async function saveUnrecognizedSection(
  documentId: number, 
  text: string, 
  className: string, 
  parentStack: { id: number; level: string; label: string }[], 
  client: Client, 
  sortOrder: number
) {
  if (parentStack.length === 0) {
    //logStep("parser", `⚠️ No parent found for unrecognized section. Saving as top-level section.`);
    await client.query(
      `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
       VALUES ($1, NULL, 'paragraf', 'content', $2, $3, $4)`,
      [documentId, text.trim(), sortOrder, className]
    );
    return;
  }

  const parent = parentStack[parentStack.length - 1];
  await client.query(
    `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
     VALUES ($1, $2, 'paragraf', 'content', $3, $4, $5)`,
    [documentId, parent.id, text.trim(), sortOrder, className]
  );

  logStep("parser", `✅ Saved Unrecognized Section (${className}) under ${parent.level} - ${parent.label}`);
}
