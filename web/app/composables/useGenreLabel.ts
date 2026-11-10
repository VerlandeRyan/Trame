/** Translated label of a format or genre code; a code without a translation is shown as is. */
export function useGenreLabel() {
  const { t, te } = useI18n()
  return (code: string) => (te(`genre.${code}`) ? t(`genre.${code}`) : code)
}
