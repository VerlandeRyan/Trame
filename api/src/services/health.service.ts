import type { HealthRepository } from '../repositories/health.repository.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
}

export interface HealthService {
  check(): Promise<HealthStatus>;
}

export function createHealthService(repository: HealthRepository): HealthService {
  return {
    async check() {
      const up = await repository.ping();
      return { status: up ? 'ok' : 'degraded', database: up ? 'up' : 'down' };
    },
  };
}
