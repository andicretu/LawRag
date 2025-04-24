// scrape-laws.ts
import puppeteer from "puppeteer";
import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { logStep } from "../loader-console";

const OUTPUT_DIR = path.resolve(process.cwd(), "output", "laws");
const IDS_FILE = path.resolve(process.cwd(), "output", "printable-ids.json");
const MAX_TO_SCRAPE = 50;

export async function scrapeLaws(): Promise<number> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (!existsSync(IDS_FILE)) {
    throw new Error("Missing printable-ids.json. Run collect-printable-ids first.");
  }

  const raw = await readFile(IDS_FILE, "utf-8");
  const { codes } = JSON.parse(raw) as { codes: string[] };

  const existingFiles = await readdir(OUTPUT_DIR);
  const existingIds = new Set(
    existingFiles.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""))
  );

  const remaining = codes.filter(code => {
    const [sourceId] = code.split(":");
    return !existingIds.has(sourceId);
  });

  logStep("scraper", `${existingIds.size} already scraped, ${remaining.length} remaining.`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let count = 0;
  for (const entry of remaining) {
    if (count >= MAX_TO_SCRAPE) break;

    const [sourceId, code] = entry.split(":");
    const outputPath = path.join(OUTPUT_DIR, `${sourceId}.json`);
    const url = `https://legislatie.just.ro/Public/FormaPrintabila/${code}`;

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

      const paragraphs = await page.evaluate(() => {
        const spanClasses = [
          "S_PAR", "S_ART_TTL", "S_ART_BDY",
          "S_DEN", "S_EMT_TTL", "S_EMT_BDY",
          "S_PUB_BDY", "S_LIT_BDY"
        ];
        return Array.from(document.querySelectorAll("span"))
          .filter(el => spanClasses.some(cls => el.classList.contains(cls)))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length > 0);
      });

      const law = {
        sourceId,
        code,
        url,
        fetchedAt: new Date().toISOString(),
        paragraphCount: paragraphs.length,
        paragraphs
      };

      await writeFile(outputPath, JSON.stringify(law, null, 2));
      logStep("scraper", `✅ Saved ${sourceId} (${paragraphs.length} paragraphs)`);
      count++;
    } catch (err) {
      logStep("scraper", `❌ Failed to scrape ${sourceId}: ${err}`);
    }
  }

  await browser.close();
  logStep("scraper", `🎉 Done scraping ${count} new laws.`);
  return count;
}

if (require.main === module) {
  scrapeLaws();
}
