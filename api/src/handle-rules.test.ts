import { describe, expect, it } from 'vitest';
import { handleSchema, isHandleAllowed } from './handle-rules.js';

describe('handleSchema', () => {
  it.each(['abc', 'Ryan', 'Ryan_B-2', 'a'.repeat(30)])('accepte %s en gardant la casse', (h) => {
    expect(handleSchema.parse(h)).toBe(h);
  });

  it('retire les espaces autour', () => {
    expect(handleSchema.parse('  Ryan  ')).toBe('Ryan');
  });

  it.each(['ab', 'a'.repeat(31), 'Mot Passe', 'é-lise', 'ryan.b', 'ryan@', ''])(
    'refuse %j',
    (h) => {
      expect(handleSchema.safeParse(h).success).toBe(false);
    },
  );
});

describe('isHandleAllowed', () => {
  it.each(['Ryan', 'lecteur42', 'manga-fan', 'Classic_Reader', 'Scunthorpe', 'assassin_fan'])(
    'autorise %s',
    (h) => {
      expect(isHandleAllowed(h)).toBe(true);
    },
  );

  it.each(['admin', 'Admin', 'ADMIN', 'Trame', 'login', 'Moderateur', 'null'])(
    'refuse le mot réservé %s',
    (h) => {
      expect(isHandleAllowed(h)).toBe(false);
    },
  );

  it.each([
    'fuck',
    'FuCk_you',
    'f_u_c_k',
    'sh1t_post',
    'Sale-Connard',
    'xxHitlerxx',
    'ntm',
    'ma_fdp',
  ])('refuse le mot offensant %s', (h) => {
    expect(isHandleAllowed(h)).toBe(false);
  });

  it('refuse un mot court seulement quand il forme un segment entier', () => {
    expect(isHandleAllowed('Nazi_Fan')).toBe(false);
    expect(isHandleAllowed('xx-Dick-xx')).toBe(false);
  });

  it('ne refuse pas un mot offensant contenu dans un mot ou un prénom courant', () => {
    for (const handle of [
      'Cockpit',
      'Fagot',
      'Bitenvert',
      'Monique',
      'Dickens',
      'Nazir',
      'Grape',
    ]) {
      expect(isHandleAllowed(handle)).toBe(true);
    }
  });
});
