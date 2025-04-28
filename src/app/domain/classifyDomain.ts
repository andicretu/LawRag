import domainData from "../domain/domains-list.json";

export function classifyDomain(title: string, emitent: string | null): string[] {
  title = title.toLowerCase();
  emitent = emitent?.toLowerCase() ?? "";

  title = title.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  emitent = emitent.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

  const matchedDomains: string[] = [];

  for (const [domain, { keywords }] of Object.entries(domainData)) {
    for (const keyword of keywords) {
      if (title.includes(keyword) || emitent.includes(keyword)) {
        matchedDomains.push(domain);
        break; // Avoid duplicate adds for same domain
      }
    }
  }

  return matchedDomains.length > 0 ? matchedDomains : ["unknown"];
}
