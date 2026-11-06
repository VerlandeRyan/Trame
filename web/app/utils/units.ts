// Les compteurs « chapitres » et « tomes » s'écrivent sous quatre formes, jamais mélangées.
// Chaque forme a sa clé de langue dans `counter.<unité>.<forme>` :
//   label    : étiquette d'un champ ou d'une colonne   « Chapitres lus »
//   unit     : nom de l'unité comptée                  « Chapitres »
//   compact  : valeur dans un espace réduit            « Ch. 3 »
//   position : où l'on en est                          « Chapitre 3 »
export type CounterUnit = 'chapters' | 'volumes'
export type CounterForm = 'label' | 'unit' | 'compact' | 'position'

export function counterKey(unit: CounterUnit, form: CounterForm): string {
  return `counter.${unit}.${form}`
}
