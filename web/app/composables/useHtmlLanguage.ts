/** Sets the `lang` and `dir` attributes of the html element from the interface language. */
export function useHtmlLanguage() {
  const localeHead = useLocaleHead({ dir: true, seo: false })
  useHead(() => ({
    htmlAttrs: {
      lang: localeHead.value.htmlAttrs?.lang,
      dir: localeHead.value.htmlAttrs?.dir,
    },
  }))
}
