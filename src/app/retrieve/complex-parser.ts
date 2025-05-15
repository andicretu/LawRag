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
  ["S_LIT_BDY", "litera"],
  ["S_ALN_BDY", "alineat"],
  ["S_NTA_BDY", "nota"],
  ["S_ANX_BDY", "anexa"],
  ["S_SMN_BDY", "semnatura"]
]);

const LEVEL_ORDER = ["titlu", "carte", "capitol", "articol", "parte"];

const LABEL_CLASS = new Set([
  "S_CAP_TTL", "S_TTL_TTL", "S_CRT_TTL", "S_ART_TTL",
  "S_POR_TTL"
]);

const NAME_CLASS = new Set([
  "S_CAP_DEN", "S_TTL_DEN", "S_CRT_DEN", "S_ART_DEN",
  "S_POR_DEN"
]);

const CONTENT_CLASS = new Set([
  "S_PAR", "S_LIT_BDY", "S_ANX_BDY", "S_PCT_BDY",
  "S_POR_BDY", "S_NTA", "S_NTA_BDY", "S_ALN_BDY", "S_SMN_BDY"
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

    const matchedLevel = classes.find(cls => LEVEL_CLASS.has(cls));
    if (matchedLevel) {
      const level = LEVEL_CLASS.get(matchedLevel)!;

      // Build the label
      let label = "";
      for (let j = i + 1; j < spans.length; j++) {
        const subClasses = spans[j].className.split(" ");

        if (LABEL_CLASS.has(subClasses[0])) {
          label = spans[j].text.trim();
        } else if (NAME_CLASS.has(subClasses[0])) {
          label += label ? ` - ${spans[j].text.trim()}` : "";
          i = j; // Skip the name span
          break;
        }

        if (LEVEL_CLASS.has(subClasses[0])) break;
      }

      const currentIndex = LEVEL_ORDER.indexOf(level);

      // Determine the correct parent based on hierarchy
      let parentId = null;
      for (let p = parentStack.length - 1; p >= 0; p--) {
        const parentLevel = parentStack[p].level;
        const parentIndex = LEVEL_ORDER.indexOf(parentLevel);

        if (parentIndex >= 0 && parentIndex < currentIndex) {
          parentId = parentStack[p].id;
          break;
        }
      }

      // Save the section with correct parent
      const result = await client.query(
        `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
         VALUES ($1, $2, $3, $4, NULL, $5, $6) RETURNING id`,
        [documentId, parentId, level, label, currentSort++, matchedLevel]
      );

      parentStack.push({ id: result.rows[0].id, level, label });
      logStep("parser", `✅ Saved Ranked Section: ${level} with label: ${label} (Source: ${matchedLevel})`);
    }

    // Detect and save content sections under the correct parent
    if (parentStack.length > 0 && classes.some(cls => CONTENT_CLASS.has(cls))) {
      const parent = parentStack[parentStack.length - 1];
      const contentLevel = LEVEL_CLASS.get(classes.find(cls => CONTENT_CLASS.has(cls))!) || "paragraf";

      await client.query(
        `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order, source_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [documentId, parent.id, contentLevel, "content", text, currentSort++, className]
      );

      logStep("parser", `✅ Saved Content Section: ${contentLevel} under ${parent.level} - ${parent.label} (Source: ${className})`);
    }
  }

  await browser.close();
  await client.end();
}
