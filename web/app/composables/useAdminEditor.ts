/** Editing state of a catalogue record (work, person or publisher), new or existing. */
import type { ArchiveImpact, ErrorScope } from '~/utils/admin'

/** What runs once a write went through (leaving the form, for instance). */
type Followup = () => void | Promise<void>

/** What is shown at the top of the record being edited. */
export interface EditedRecord {
  archived: boolean
  /** Not yet published: only the title or name is required to save it. */
  draft: boolean
  heading: string
  /** Works only: what archiving leaves in place, recalled in the confirmation. */
  impact?: ArchiveImpact
}

/** Loads, edits, saves and archives one record; the draft lives in shared state. */
export function useAdminEditor(kind: AdminKind, id: number | 'new') {
  const client = useAdminClient()

  // `useState`: the draft loaded during server rendering is picked up as is by the browser.
  /** Key of one piece of the editor state, unique per record. */
  const stateKey = (name: string) => `admin-${name}-${kind}-${id}`
  const work = useState<WorkDraft>(stateKey('work'), emptyWorkDraft)
  const person = useState<PersonDraft>(stateKey('person'), emptyPersonDraft)
  const publisher = useState<PublisherDraft>(stateKey('publisher'), emptyPublisherDraft)
  const record = useState<EditedRecord | null>(stateKey('record'), () => null)
  const errorKey = ref<string>()
  /** What the last refused save asks the form to flag: the title or name (draft) or every gap (publication). */
  const errorScope = ref<ErrorScope>('none')
  const saving = ref(false)
  const announceFailure = useAdminFailure()

  // A new record always starts empty: the state survives navigation within the site.
  if (id === 'new') {
    work.value = emptyWorkDraft()
    person.value = emptyPersonDraft()
    publisher.value = emptyPublisherDraft()
  }

  /** The draft of the kind being edited. */
  const currentDraft = () => {
    if (kind === 'works') return work.value
    return kind === 'people' ? person.value : publisher.value
  }

  const savedSnapshot = ref(JSON.stringify(currentDraft()))
  const isDirty = computed(() => JSON.stringify(currentDraft()) !== savedSnapshot.value)
  /** Remembers the current draft as the saved state. */
  const markSaved = () => (savedSnapshot.value = JSON.stringify(currentDraft()))

  /** Reads the existing record into its draft; does nothing for a new one. */
  async function load() {
    if (id === 'new') return
    if (kind === 'works') {
      const loaded = await client.get<AdminWork>(kind, id)
      work.value = workToDraft(loaded)
      record.value = {
        archived: loaded.archived,
        draft: loaded.draft,
        heading: loaded.title,
        impact: archiveImpact(loaded),
      }
    } else if (kind === 'people') {
      const loaded = await client.get<AdminPerson>(kind, id)
      person.value = personToDraft(loaded)
      record.value = { archived: loaded.archived, draft: loaded.draft, heading: loaded.name }
    } else {
      const loaded = await client.get<AdminPublisher>(kind, id)
      publisher.value = publisherToDraft(loaded)
      record.value = { archived: loaded.archived, draft: loaded.draft, heading: loaded.name }
    }
    markSaved()
  }

  /** API body built from the current draft. */
  const body = () => {
    if (kind === 'works') return draftToWorkBody(work.value)
    return kind === 'people'
      ? draftToPersonBody(person.value)
      : draftToPublisherBody(publisher.value)
  }

  /**
   * Whether the record has what `scope` asks for: `title` = the title or name and any typed address
   * (a draft), `all` = every required field and row (publication; `formatCodes`: formats a work may carry).
   */
  function hasGaps(scope: Exclude<ErrorScope, 'none'>, formatCodes: readonly string[]): boolean {
    const isFull = scope === 'all'
    if (kind === 'works') {
      return isFull ? hasIncompleteForm(work.value, formatCodes) : hasUnsavableDraft(work.value)
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
    if (!hasGaps(scope, formatCodes)) return true
    errorKey.value = INCOMPLETE_FORM_ERROR_KEY
    errorScope.value = scope
    return false
  }

  /** Whether the record has every field publishing needs; otherwise flags the gaps. */
  const checkPublishable = (formatCodes: readonly string[] = []) => validate('all', formatCodes)

  /** Whether the record stays a draft after this save (`publish` asks for the full checks). */
  const staysDraft = (publish: boolean) =>
    !publish && (id === 'new' || record.value?.draft === true)

  /**
   * Publishes the saved draft. The edit is already saved, so a transient failure offers a "Retry"
   * that only replays the publication, then runs `onDone`.
   */
  async function publishSaved(onDone?: Followup): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await client.publish(kind, id)
      if (record.value) record.value = { ...record.value, draft: false }
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void publishSaved(onDone))
      return false
    }
    await onDone?.()
    return true
  }

  /**
   * Saves; true if the API accepted. A new record is created as a draft unless `publish`; a draft
   * only needs its title or name; publishing (or saving a published record) needs every required
   * field. Publishing an existing draft saves, then publishes. `onDone` runs once everything went
   * through, also after a retry. A transient failure is announced with "Retry"; a refusal shows its
   * message in the form (`errorKey`, see `announceFailure`).
   */
  async function save(
    formatCodes: readonly string[] = [],
    publish = false,
    onDone?: Followup,
  ): Promise<boolean> {
    if (!validate(staysDraft(publish) ? 'title' : 'all', formatCodes)) return false
    saving.value = true
    try {
      if (id === 'new') await client.create(kind, { ...body(), published: publish })
      else await client.replace(kind, id, body())
      markSaved()
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void save(formatCodes, publish, onDone))
      return false
    } finally {
      saving.value = false
    }
    if (publish && id !== 'new' && record.value?.draft) return publishSaved(onDone)
    await onDone?.()
    return true
  }

  /** Deletes the draft for good; true if the API accepted (`onDone` then runs, also after a retry). */
  async function deleteDraft(onDone?: Followup): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await client.removeDraft(kind, id)
      markSaved()
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void deleteDraft(onDone))
      return false
    }
    await onDone?.()
    return true
  }

  /** Archives or restores the record; true if the API accepted (`onDone` then runs, also after a retry). */
  async function setArchived(archived: boolean, onDone?: Followup): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await (archived ? client.archive(kind, id) : client.restore(kind, id))
      if (record.value) record.value = { ...record.value, archived }
    } catch (cause) {
      errorKey.value = announceFailure(cause, () => void setArchived(archived, onDone))
      return false
    }
    await onDone?.()
    return true
  }

  return {
    work,
    person,
    publisher,
    record,
    errorKey,
    errorScope,
    saving,
    isDirty,
    load,
    save,
    checkPublishable,
    deleteDraft,
    setArchived,
    client,
  }
}
