/** The single rule of what a work needs to be published, served to the web and enforced on publication. */
import { PUBLICATION_GAPS, type PublicationGap } from '../domain/catalogue-enums.js';
import type { AdminWorkCreateInput } from '../repositories/admin-work.repository.js';

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
