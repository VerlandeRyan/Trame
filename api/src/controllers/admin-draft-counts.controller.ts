/** HTTP handler of the number of drafts per administered resource. */
import type { RequestHandler } from 'express';

/** Services that count their drafts. */
interface DraftCounter {
  countDrafts(): Promise<number>;
}

/** Number of drafts of each resource, in one response. */
export interface DraftCounts {
  works: number;
  people: number;
  publishers: number;
}

/** Builds the handler answering `{ works, people, publishers }`. */
export function createDraftCountsController(services: {
  works: DraftCounter;
  people: DraftCounter;
  publishers: DraftCounter;
}): RequestHandler {
  return async (_req, res) => {
    const [works, people, publishers] = await Promise.all([
      services.works.countDrafts(),
      services.people.countDrafts(),
      services.publishers.countDrafts(),
    ]);
    const counts: DraftCounts = { works, people, publishers };
    res.json(counts);
  };
}
