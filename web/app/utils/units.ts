/**
 * Chapter and volume counters are written in four forms, never mixed. Each form has its
 * translation key `counter.<unit>.<form>`:
 *   label    : label of a field or column          "Chapters read"
 *   unit     : name of the counted unit            "Chapters"
 *   compact  : value in a tight space              "Ch. 3"
 *   position : where the reader is                 "Chapter 3"
 */
export type CounterUnit = 'chapters' | 'volumes'
/** One of the four written forms of a counter. */
export type CounterForm = 'label' | 'unit' | 'compact' | 'position'

/** Translation key of a counter unit in a given form. */
export function counterKey(unit: CounterUnit, form: CounterForm): string {
  return `counter.${unit}.${form}`
}
