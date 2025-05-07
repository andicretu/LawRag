import { Page } from "puppeteer";
import { Pool } from "pg";

// PostgreSQL connection configuration
const pool = new Pool({
  user: "andicretu",
  host: "localhost",
  database: "lawrag",
  password: "your_password_here",
  port: 5432, // Default PostgreSQL port
});

// Type Definition for Reference
export type ReferenceStub = {
  sourceDetaliiId: number;
  referenceType: string;
  targetCodeText: string;
  sectionLabel: string | null;
};

// Type Map (raw types to ENUM values)
const typeMap: Record<string, string> = {
  "MODIFICAT DE": "is_modified_by",
  "COMPLETAT DE": "is_completed_by",
  "ABROGAT DE": "is_abrogated_by",
  "ABROGA": "abrogates",
  "REFERA PE": "refers_to",
  "REFERIT DE": "is_referred_by",
  "ACTUALIZEAZA PE": "updates",
  "SUSPENDAT DE": "is_suspended_by",
  "SUSPENDA": "suspends",
  "RECTIFICAT DE": "is_corrected_by",
  "RECTIFICA": "corrects",
  "ARE LEGATURA CU": "refers_to",
  "REFERIRE LA": "refers_to"
};

// Function to clean text values
const clean = (text: string | null): string =>
  text?.replace(/\s+/g, " ").trim() ?? "";

// Function to extract references from a document page
export async function extractReferencesFromPage(
  page: Page,
  detaliiId: number
): Promise<ReferenceStub[]> {
  await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('.fisa_act_chk');
    checkboxes.forEach(cb => {
      if (!(cb as HTMLInputElement).checked) {
        (cb as HTMLInputElement).click();
      }
    });
  });

  // Wait for tables to appear
  await page.waitForSelector('#actiuni_suferite table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#actiuni_induse table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#refera_pe table', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#referit_de table', { timeout: 5000 }).catch(() => {});

  const rawRefs = await page.evaluate((detaliiId, typeMap) => {
    const references: {
      sourceDetaliiId: number;
      referenceType: string;
      targetCodeText: string;
      sectionLabel: string | null;
    }[] = [];

    document.querySelectorAll("table tr").forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) return;

      const section = cells[0]?.textContent?.trim() || "";
      const rawType = cells[1]?.textContent?.trim() || "";
      const targetCodeText = cells[2]?.textContent?.trim() || "";

      const normalizedType = typeMap[rawType];
      if (!normalizedType || !targetCodeText) return;

      references.push({
        sourceDetaliiId: detaliiId,
        referenceType: normalizedType,
        targetCodeText,
        sectionLabel: section || null
      });
    });

    return references;
  }, detaliiId, typeMap);

  // Clean references outside the page context
  const cleanedRefs = rawRefs.map(ref => ({
    sourceDetaliiId: ref.sourceDetaliiId,
    referenceType: ref.referenceType,
    targetCodeText: clean(ref.targetCodeText).slice(0, 255),
    sectionLabel: ref.sectionLabel ? clean(ref.sectionLabel).slice(0, 255) : null
  }));

  await saveReferencesToDb(cleanedRefs);
  return cleanedRefs;
}

// Function to save references directly to the database
async function saveReferencesToDb(references: ReferenceStub[]) {
  if (references.length === 0) return;

  const queryText = `
    INSERT INTO legal_references (source_detalii_id, reference_type, target_code_text, section_label)
    VALUES ${references
      .map((_, index) => 
        `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
      ).join(", ")}
  `;

  const values = references.flatMap(ref => [
    ref.sourceDetaliiId,
    ref.referenceType,
    ref.targetCodeText,
    ref.sectionLabel
  ]);

  try {
    await pool.query(queryText, values);
    console.log(`Saved ${references.length} references directly to the database.`);
  } catch (error) {
    console.error("❌ Error saving references to the database:", error);
  }
}

// Function to collect and save references directly from a page
export async function collectAndSaveReferences(page: Page, detaliiId: number) {
    const references = await extractReferencesFromPage(page, detaliiId);
    console.log(`Extracted ${references.length} references for document ${detaliiId}`);
}
  
