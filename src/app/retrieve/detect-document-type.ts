// src/app/retrieve/detect-document-type.ts

import documentTypes from "../domain/document-types.json";

/**
 * Detects the document type based on the title and optionally emitent.
 * If no match is found, returns "unknown".
 */
export function detectDocumentType(title: string | null | undefined): string {
    title = title?.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? "";
    title = title?.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  for (const [type, { label }] of Object.entries(documentTypes)) {
    const keyword = label.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

    // Strong match if title starts with the keyword
    if (title.startsWith(keyword)) {
      return type;
    }

    // Weaker match if keyword appears somewhere in title
    if (title.includes(keyword)) {
      return type;
    }

  }

  return "UNKNOWN";
}
