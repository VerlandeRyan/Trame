/** Editing state of a catalogue record (work, person or publisher), new or existing. */
import type { ApiError } from '~/utils/api-error'
import type { AdminLifecycle, ArchiveImpact, ErrorScope, PublicationGap } from '~/utils/admin'

/** What runs once a write went through (leaving the form, for instance). */
type Followup = () => void | Promise<void>

/** What is shown at the top of the record being edited. */
export interface EditedRecord {
  /** A draft only needs its title or name to be saved. */
  lifecycle: AdminLifecycle
  heading: string
  /** Works only: what archiving leaves in place, recalled in the confirmation. */
  impact?: ArchiveImpact
  /** Works only: what the API says the saved record still lacks to be published. */
  publicationGaps?: PublicationGap[]
}

/** Translation key of the toast announcing a save: published, kept as a draft, or plainly saved. */
function savedMessageKey(publish: boolean, keepsDraft: boolean): string {
  if (publish) return 'toast.recordPublished'
  return keepsDraft ? 'toast.draftSaved' : 'toast.recordSaved'
}

/** Loads, edits, saves and archives one record; the form values live in shared state. */
export function useAdminEditor(kind: AdminKind, id: number | 'new') {
  const client = useAdminClient()

  // `useState`: the form values loaded during server rendering is picked up as is by the browser.
  /** Key of one piece of the editor state, unique per record. */
  const stateKey = (name: string) => `admin-${name}-${kind}-${id}`
  const work = useState<WorkFormValues>(stateKey('work'), emptyWorkFormValues)
  const person = useState<PersonFormValues>(stateKey('person'), emptyPersonFormValues)
  const publisher = useState<PublisherFormValues>(stateKey('publisher'), emptyPublisherFormValues)
  const record = useState<EditedRecord | null>(stateKey('record'), () => null)
  const errorKey = ref<string>()
  /** What the last refused save asks the form to flag: the title or name (draft) or every gap (publication). */
  const errorScope = ref<ErrorScope>('none')
  /** Gaps named by the API's last refusal, with the form values it refused. */
  const refusal = ref<{ gaps: PublicationGap[]; formValues: string }>({ gaps: [], formValues: '' })
  const saving = ref(false)
  const announceFailure = useAdminFailure()
  const { show } = useToasts()
  const announceArchiveChange = useArchiveUndo()

  // A new record always starts empty: the state survives navigation within the site.
  if (id === 'new') {
    work.value = emptyWorkFormValues()
    person.value = emptyPersonFormValues()
    publisher.value = emptyPublisherFormValues()
  }

  /** The form values of the kind being edited. */
  const currentFormValues = () => {
    if (kind === 'works') return work.value
    return kind === 'people' ? person.value : publisher.value
  }

  const savedSnapshot = ref(JSON.stringify(currentFormValues()))
  const isDirty = computed(() => JSON.stringify(currentFormValues()) !== savedSnapshot.value)
  /** Remembers the current form values as the saved state. */
  const markSaved = () => (savedSnapshot.value = JSON.stringify(currentFormValues()))
  /** Gaps the API reported: its refusal of the current input, and the saved record's own while unchanged. */
  const serverGaps = computed<PublicationGap[]>(() => [
    ...(refusal.value.gaps.length > 0 &&
    refusal.value.formValues === JSON.stringify(currentFormValues())
      ? refusal.value.gaps
      : []),
    ...(isDirty.value ? [] : (record.value?.publicationGaps ?? [])),
  ])

  /** Reads the existing record into its form values; does nothing for a new one. */
  async function load() {
    if (id === 'new') return
    if (kind === 'works') {
      const loaded = await client.get<AdminWork>(kind, id)
      work.value = workToFormValues(loaded)
      record.value = {
        lifecycle: loaded.lifecycle,
        heading: loaded.title,
        impact: archiveImpact(loaded),
        publicationGaps: loaded.publicationGaps,
      }
    } else if (kind === 'people') {
      const loaded = await client.get<AdminPerson>(kind, id)
      person.value = personToFormValues(loaded)
      record.value = { lifecycle: loaded.lifecycle, heading: loaded.name }
    } else {
      const loaded = await client.get<AdminPublisher>(kind, id)
      publisher.value = publisherToFormValues(loaded)
      record.value = { lifecycle: loaded.lifecycle, heading: loaded.name }
    }
    markSaved()
  }

  /** API body built from the current form values. */
  const body = () => {
    if (kind === 'works') return formValuesToWorkBody(work.value)
    return kind === 'people'
      ? formValuesToPersonBody(person.value)
      : formValuesToPublisherBody(publisher.value)
  }

  /**
   * Whether the record has what `scope` asks for: `title` = the title or name and any typed address
   * (a draft), `all` = every required field and row (publication; `formatCodes`: formats a work may carry).
   */
  function hasGaps(scope: Exclude<ErrorScope, 'none'>, formatCodes: readonly string[]): boolean {
    const isFull = scope === 'all'
    if (kind === 'works') {
      return isFull
        ? hasIncompleteForm(work.value, formatCodes, serverGaps.value)
        : hasUnsavableDraft(work.value)
    }
    if (kind === 'people') {
      return isBlank(person.value.name) || hasInvalidLinkUrl(person.value.links, isFull)
    }
    return isBlank(publisher.value.name) || urlErrorKey(publisher.value.url, false) !== undefined
  }

  /** Checks the record for `scope`; otherwise flags the gaps (`errorKey`, `errorScope`) without calling the API. */
  function validate(scope: Exclude<ErrorScope, 'none'>, formatCodes: readonly string[]): boolean {
    errorKey.value = undefined
    errorScope.value = 'none'
    refusal.value = { gaps: [], formValues: '' }
    if (!hasGaps(scope, formatCodes)) return true
    errorKey.value = INCOMPLETE_FORM_ERROR_KEY
    errorScope.value = scope
    return false
  }

  /** Whether the record has every field publishing needs; otherwise flags the gaps. */
  const checkPublishable = (formatCodes: readonly string[] = []) => validate('all', formatCodes)

  /** Whether the record stays a draft after this save (`publish` asks for the full checks). */
  const staysDraft = (publish: boolean) =>
    !publish && (id === 'new' || record.value?.lifecycle === 'draft')

  /**
   * Saves; true if the API accepted. A new record is created as a draft unless `publish`; a draft
   * only needs its title or name; publishing (or saving a published record) needs every required
   * field. Publishing an existing draft is part of the same write. `onDone` runs once it went
   * through, also after a retry. A transient failure is announced with "Retry"; a refusal shows its
   * message in the form (`errorKey`, see `announceFailure`).
   */
  async function save(
    formatCodes: readonly string[] = [],
    publish = false,
    onDone?: Followup,
  ): Promise<boolean> {
    const keepsDraft = staysDraft(publish)
    if (!validate(keepsDraft ? 'title' : 'all', formatCodes)) return false
    saving.value = true
    try {
      if (id === 'new') await client.create(kind, { ...body(), published: publish })
      else {
        const saved = await client.update<{ publicationGaps?: PublicationGap[] } | undefined>(
          kind,
          id,
          publish ? { ...body(), published: true } : body(),
        )
        if (record.value) {
          record.value = {
            ...record.value,
            lifecycle: publish ? 'published' : record.value.lifecycle,
            publicationGaps: saved?.publicationGaps,
          }
        }
      }
      markSaved()
    } catch (cause) {
      const gaps = gapsOfRefusal(cause as ApiError)
      refusal.value = { gaps, formValues: JSON.stringify(currentFormValues()) }
      if (gaps.length > 0) errorScope.value = 'all'
      errorKey.value = announceFailure(cause, () => void save(formatCodes, publish, onDone))
      return false
    } finally {
      saving.value = false
    }
    show({ tone: 'success', messageKey: savedMessageKey(publish, keepsDraft) })
    await onDone?.()
    return true
  }

  /** Deletes the draft or archived record for good; true if the API accepted (`onDone` then runs, also after a retry). */
  async function deleteRecord(onDone?: Followup): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await client.remove(kind, id)
      markSaved()
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void deleteRecord(onDone))
      return false
    }
    show({ tone: 'success', messageKey: 'toast.recordDeleted' })
    await onDone?.()
    return true
  }

  /** Archives or restores the record; true if the API accepted (`onDone` then runs, also after a retry). */
  async function setArchived(archived: boolean, onDone?: Followup): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await (archived ? client.archive(kind, id) : client.restore(kind, id))
      if (record.value) {
        record.value = { ...record.value, lifecycle: archived ? 'archived' : 'published' }
      }
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void setArchived(archived, onDone))
      return false
    }
    // After `onDone` (which may leave the page): a toast with "Undo" closes when the page changes.
    await onDone?.()
    announceArchiveChange(kind, id, archived)
    return true
  }

  return {
    work,
    person,
    publisher,
    record,
    errorKey,
    errorScope,
    serverGaps,
    saving,
    isDirty,
    load,
    save,
    checkPublishable,
    deleteRecord,
    setArchived,
    client,
  }
}
