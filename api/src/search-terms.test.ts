import { describe, expect, it } from 'vitest';
import { MAX_SEARCH_TERMS, searchTerms } from './search-terms.js';

describe('searchTerms', () => {
  it('découpe la recherche en mots', () => {
    expect(searchTerms('aube manga')).toEqual(['aube', 'manga']);
  });

  it('ignore les espaces multiples, en tête et en queue', () => {
    expect(searchTerms('  étoile   vagabonde ')).toEqual(['étoile', 'vagabonde']);
  });

  it('retire les doublons sans tenir compte de la casse', () => {
    expect(searchTerms('Brume brume BRUME nuit')).toEqual(['Brume', 'nuit']);
  });

  it('renvoie une liste vide pour une chaîne vide', () => {
    expect(searchTerms('   ')).toEqual([]);
  });

  it(`garde au plus ${MAX_SEARCH_TERMS} mots`, () => {
    const words = Array.from({ length: MAX_SEARCH_TERMS + 3 }, (_, index) => `mot${index}`);

    expect(searchTerms(words.join(' '))).toEqual(words.slice(0, MAX_SEARCH_TERMS));
  });
});
