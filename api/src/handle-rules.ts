import { z } from 'zod';

/** Même format que la contrainte SQL de `app_user` ; la casse saisie est conservée. */
export const handleSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,30}$/);

/** Pages, actions, rôles et noms du service (la contrainte SQL n'en garde que le noyau). */
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

/** Mots offensants (français et anglais) refusés où qu'ils soient : aucun mot courant ne les contient. */
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

/** Refusés seulement comme segment entier (`nazi_fan`) : ailleurs ils toucheraient Monique, Dickens, Nazir… */
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

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

/** Minuscules, chiffres lus comme les lettres qu'ils imitent (`sh1t` → `shit`). */
function readLookAlikes(text: string): string {
  return [...text.toLowerCase()].map((char) => LEET[char] ?? char).join('');
}

/** `true` si le handle n'est ni réservé ni offensant (son format est déjà validé par `handleSchema`). */
export function isHandleAllowed(handle: string): boolean {
  if (RESERVED.has(handle.toLowerCase())) return false;
  const segments = handle.split(/[_-]/).map(readLookAlikes);
  const joined = segments.join('');
  if (OFFENSIVE_ANYWHERE.some((word) => joined.includes(word))) return false;
  return !OFFENSIVE_WHOLE.some((word) => joined === word || segments.includes(word));
}
