/** Service reporting whether the API and its database are healthy. */
import type { HealthRepository } from '../repositories/health.repository.js';

/** Health report: `degraded` when the database does not answer. */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

/** Health operations. */
export interface HealthService {
  check(): Promise<HealthStatus>;
}

/** Creates the health service. */
export function createHealthService(repository: HealthRepository): HealthService {
  return {
    async check() {
      const up = await repository.ping();
      return { status: up ? 'ok' : 'degraded', database: up ? 'up' : 'down' };
    },
  };
}
