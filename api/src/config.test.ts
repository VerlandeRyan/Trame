import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applique le port par défaut', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame' });
    expect(config).toEqual({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame', PORT: 3000 });
  });

  it('convertit le port en nombre', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame', PORT: '8080' });
    expect(config.PORT).toBe(8080);
  });

  it('refuse une configuration sans DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/Configuration invalide.*DATABASE_URL/);
  });

  it('refuse un DATABASE_URL vide', () => {
    expect(() => loadConfig({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it.each(['0', '70000', 'abc', '80.5'])('refuse le port invalide %s', (port) => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/trame', PORT: port })).toThrow(
      /PORT/,
    );
  });
});
