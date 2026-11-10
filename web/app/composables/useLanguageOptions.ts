/** Language menu options labelled in the interface language. */
import { languageOptions } from '~/utils/admin'

/** Builds the options of a language menu, labelled in the interface language. */
export function useLanguageOptions() {
  const { locale } = useI18n()
  const names = computed(() => new Intl.DisplayNames([locale.value], { type: 'language' }))
  /** Name of a language in the interface language, or the code itself. */
  const nameOf = (code: string) => names.value.of(code) ?? code
  return (current = '') => languageOptions(nameOf, current)
}
