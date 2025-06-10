import documentTypesRaw from "../domain/document-types.json";

type DocumentTypeDefinition = {
  label: string;
  scraping_complexity: string;
  aliases?: string[];
};

const documentTypes = documentTypesRaw as Record<string, DocumentTypeDefinition>;

export function detectDocumentType(title: string | null | undefined, emitent: string | null): string {
  if (!title) return "UNKNOWN";

  title = title.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  emitent = emitent?.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? "";

  for (const [type, { label, aliases }] of Object.entries(documentTypes)) {
    const allKeywords = [label, ...(aliases || [])].map(k =>
      k.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    );

    for (const keyword of allKeywords) {
      if (title.startsWith(keyword)) return type;
      if (title.includes(keyword) || emitent.includes(keyword)) return type;
    }
  }

  return "UNKNOWN";
}
