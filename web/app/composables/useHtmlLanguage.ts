/** Attributs `lang` et `dir` de <html> selon la langue de l'interface. */
export function useHtmlLanguage() {
  const localeHead = useLocaleHead({ dir: true, seo: false })
  useHead(() => ({
    htmlAttrs: {
      lang: localeHead.value.htmlAttrs?.lang,
      dir: localeHead.value.htmlAttrs?.dir,
    },
  }))
}
