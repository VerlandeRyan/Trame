/** Nombre maximal de mots d'une recherche ; les suivants sont ignorés. */
export const MAX_SEARCH_TERMS = 6;

/** Mots séparés par des espaces, sans doublon (casse ignorée), `MAX_SEARCH_TERMS` au plus. */
export function searchTerms(q: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of q.split(/\s+/)) {
    const key = term.toLowerCase();
    if (term === '' || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  return terms.slice(0, MAX_SEARCH_TERMS);
}
