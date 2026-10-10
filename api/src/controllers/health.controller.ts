import type { RequestHandler } from 'express';
import type { HealthService } from '../services/health.service.js';

export function createHealthController(service: HealthService): { get: RequestHandler } {
  return {
    async get(_req, res) {
      const health = await service.check();
      res.status(health.status === 'ok' ? 200 : 503).json(health);
    },
  };
}
