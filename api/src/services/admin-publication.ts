/** The single rule of what a work needs to be published, served to the web and enforced on publication. */
import type { AdminWorkCreateInput } from '../repositories/admin-work.repository.js';

/** Names of the fields (as the API calls them) a work can lack to be published. */
export const PUBLICATION_GAPS = ['genres', 'credits', 'publisherIds', 'synopses'] as const;
export type PublicationGap = (typeof PUBLICATION_GAPS)[number];

/**
 * Fields a published work cannot do without: a format, an author, a publisher and a synopsis in
 * the original language.
 */
export function publicationGaps(
  work: Pick<AdminWorkCreateInput, 'credits' | 'publisherIds' | 'synopses' | 'originalLanguage'>,
  hasFormat: boolean,
): PublicationGap[] {
  const isMissing: Record<PublicationGap, boolean> = {
    genres: !hasFormat,
    credits: work.credits.length === 0,
    publisherIds: work.publisherIds.length === 0,
    synopses: !work.synopses.some((synopsis) => synopsis.language === work.originalLanguage),
  };
  return PUBLICATION_GAPS.filter((gap) => isMissing[gap]);
}
