/** HTTP controller of public member profiles and the profile visibility setting. */
import type { RequestHandler } from 'express';
import { currentUser } from '../middleware/auth.js';
import { validated } from '../middleware/validate.js';
import { listEntriesQuery } from '../schemas/library.js';
import { profileParams, profileQuery, visibilityBody } from '../schemas/profile.js';
import type { ProfileService } from '../services/profile.service.js';

/** Builds the profile request handlers. */
export function createProfileController(service: ProfileService): {
  get: RequestHandler;
  listEntries: RequestHandler;
  setVisibility: RequestHandler;
} {
  return {
    async get(req, res) {
      const { handle } = validated(profileParams, req.params);
      const { lang } = validated(profileQuery, req.query);
      res.json(await service.get(handle, req.user, lang));
    },

    async listEntries(req, res) {
      const { handle } = validated(profileParams, req.params);
      const input = validated(listEntriesQuery, req.query);
      res.json(await service.listEntries(handle, req.user, input));
    },

    async setVisibility(req, res) {
      const { visibility } = validated(visibilityBody, req.body);
      await service.setVisibility(currentUser(req).id, visibility);
      res.json({ visibility });
    },
  };
}
