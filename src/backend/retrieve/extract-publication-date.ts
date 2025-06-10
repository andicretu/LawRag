// src/app/retrieve/extract-publication-date.ts

import { Page } from "puppeteer";

/**
 * Attempts to extract the publication date of a law from the title or complementary spans.
 * Priority:
 * 1. Extract from S_DEN title (if possible)
 * 2. Extract from S_PAR span if it contains (LEGE nr. xx din date)
 * 3. Return null if not found.
 */
export async function extractPublicationDate(page: Page): Promise<string | null> {
  // Try to get from S_DEN first
  try {
    const titleText = await page.$eval('span.S_DEN', el => el.textContent?.trim() ?? "");
    const dateFromTitle = extractDateFromText(titleText);
    if (dateFromTitle) {
      return dateFromTitle;
    }
  } catch {
    // No title or extraction failed
  }

  // If not found, try to get from S_PAR
  try {
    const spans = await page.$$eval('span.S_PAR', elements => elements.map(el => el.textContent?.trim() ?? ""));
    for (const text of spans) {
      if (text.includes("LEGE") && text.includes("din")) {
        const dateFromSpan = extractDateFromText(text);
        if (dateFromSpan) {
          return dateFromSpan;
        }
      }
    }
  } catch {
    // No spans or extraction failed
  }

  // If everything fails
  return null;
}

/**
 * Helper to extract a date string in YYYY-MM-DD format from a text.
 */
function extractDateFromText(text: string): string | null {
  const monthMap: Record<string, string> = {
    'ianuarie': '01',
    'februarie': '02',
    'martie': '03',
    'aprilie': '04',
    'mai': '05',
    'iunie': '06',
    'iulie': '07',
    'august': '08',
    'septembrie': '09',
    'octombrie': '10',
    'noiembrie': '11',
    'decembrie': '12',
  };

  const regex = /(\d{1,2})\s+(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\s+(\d{4})/i;
  const match = text.match(regex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const month = monthMap[match[2].toLowerCase()];
    const year = match[3];

    return `${year}-${month}-${day}`;
  }

  return null;
}
