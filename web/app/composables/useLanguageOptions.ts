import { languageOptions } from '~/utils/admin'

/** Fabrique les options d'un menu de langues, libellées dans la langue de l'interface. */
export function useLanguageOptions() {
  const { locale } = useI18n()
  const names = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))
  const nameOf = (code: string) => names.value.of(code) ?? code
  return (current = '') => languageOptions(nameOf, current)
}
