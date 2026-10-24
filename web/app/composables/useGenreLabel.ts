/** Libellé traduit d'un code de format ou de genre ; un code sans traduction s'affiche tel quel. */
export function useGenreLabel() {
  const { t, te } = useI18n()
  return (code: string) => (te(`genre.${code}`) ? t(`genre.${code}`) : code)
}
