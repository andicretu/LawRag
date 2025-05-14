import puppeteer from "puppeteer";
import { Client } from "pg";
import { logStep } from "../loader-console";

// Define Class Categories
const LEVEL_CLASS = new Map([
  ["S_TTL", "titlu"],
  ["S_CRT", "carte"],
  ["S_CAP", "capitol"],
  ["S_ART", "articol"],
  ["S_POR", "parte"]
]);

const LABEL_CLASS = new Set([
  "S_CAP_TTL", "S_TTL_TTL", "S_CRT_TTL", "S_ART_TTL",
  "S_POR_TTL"
]);

const NAME_CLASS = new Set([
  "S_CAP_DEN", "S_TTL_DEN", "S_CRT_DEN", "S_ART_DEN",
  "S_POR_DEN"
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

  for (let i = 0; i < spans.length; i++) {
    const { className, text } = spans[i];
    if (!text.trim()) continue;

    const classes = className.split(" ");

    const matchedLevel = classes.find(cls => LEVEL_CLASS.has(cls));
    if (matchedLevel) {
      const level = LEVEL_CLASS.get(matchedLevel)!;

      // Search for the label and description only within this level
      let label = "";

      // Find the main title (LABEL_CLASS) inside the level
      for (let j = i + 1; j < spans.length; j++) {
        const subClasses = spans[j].className.split(" ");

        if (LABEL_CLASS.has(subClasses[0])) {
          label = spans[j].text.trim();
        } else if (NAME_CLASS.has(subClasses[0])) {
          label += label ? ` - ${spans[j].text.trim()}` : "";
          i = j; // Skip the name span
          break; // Stop searching within this section
        }

        // Stop if another level starts
        if (LEVEL_CLASS.has(subClasses[0])) break;
      }

      if (label) {
        await client.query(
          `INSERT INTO nodes (document_id, parent_id, level, label, content, sort_order)
           VALUES ($1, NULL, $2, $3, $4, $5)`,
          [documentId, level, label, "nc", currentSort++]
        );

        logStep("parser", `✅ Saved Ranked Section: ${level} with label: ${label}`);
      }
    }
  }

  await browser.close();
  await client.end();
}