/** Shared flag: the page being edited holds input that is not saved yet. */
export function useUnsavedChanges() {
  return useState<boolean>('unsaved-changes', () => false)
}
