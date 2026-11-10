/** Splits a catalogue search into words. */

/** Maximum number of words in a search; the following ones are ignored. */
export const MAX_SEARCH_TERMS = 6;

/** Whitespace-separated words, without duplicates (case ignored), at most `MAX_SEARCH_TERMS`. */
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
