/** Handle format and moderation rules: reserved words and offensive terms are refused. */
import { z } from 'zod';

/** Same format as the database constraint; the typed case is kept. */
export const handleSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,30}$/);

/** Page names, actions, roles and service names (the database constraint only keeps the core). */
const RESERVED = new Set([
  'admin',
  'administrator',
  'administrateur',
  'moderator',
  'moderateur',
  'modo',
  'equipe',
  'team',
  'staff',
  'support',
  'contact',
  'aide',
  'help',
  'system',
  'systeme',
  'anonyme',
  'anonymous',
  'root',
  'trame',
  'api',
  'oeuvre',
  'oeuvres',
  'official',
  'officiel',
  'null',
  'undefined',
  'me',
  'moi',
  'login',
  'logout',
  'signin',
  'signup',
  'register',
  'auth',
  'account',
  'compte',
  'settings',
  'parametres',
  'profile',
  'profil',
  'search',
  'recherche',
  'explore',
  'explorer',
  'community',
  'communaute',
  'u',
  'user',
  'users',
  'www',
  'about',
  'privacy',
  'terms',
]);

/** Offensive words (French and English) refused anywhere in a handle: no common word contains them. */
const OFFENSIVE_ANYWHERE = [
  'fuck',
  'shit',
  'bitch',
  'whore',
  'pussy',
  'nigger',
  'nigga',
  'faggot',
  'rapist',
  'hitler',
  'kkk',
  'pedophile',
  'paedophile',
  'connard',
  'connasse',
  'salope',
  'putain',
  'encule',
  'enculer',
  'batard',
  'merde',
  'couille',
  'bougnoule',
  'tapette',
  'violeur',
];

/** Refused only as a whole segment (`nazi_fan`): elsewhere they would hit ordinary names such as Monique or Dickens. */
const OFFENSIVE_WHOLE = [
  'cunt',
  'dick',
  'cock',
  'slut',
  'fag',
  'retard',
  'rape',
  'nazi',
  'pedo',
  'pute',
  'nique',
  'niquer',
  'ntm',
  'fdp',
  'bite',
  'negre',
  'pd',
  'viol',
];

/** Digits read as the letters they imitate. */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

/** Lowercases and reads look-alike digits as letters (`sh1t` → `shit`). */
function readLookAlikes(text: string): string {
  return [...text.toLowerCase()].map((char) => LEET[char] ?? char).join('');
}

/** Whether the handle is neither reserved nor offensive (its format is already checked by `handleSchema`). */
export function isHandleAllowed(handle: string): boolean {
  if (RESERVED.has(handle.toLowerCase())) return false;
  const segments = handle.split(/[_-]/).map(readLookAlikes);
  const joined = segments.join('');
  if (OFFENSIVE_ANYWHERE.some((word) => joined.includes(word))) return false;
  return !OFFENSIVE_WHOLE.some((word) => joined === word || segments.includes(word));
}
