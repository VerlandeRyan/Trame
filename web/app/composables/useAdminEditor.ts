/** Editing state of a catalogue record (work, person or publisher), new or existing. */
import type { ArchiveImpact } from '~/utils/admin'

/** What is shown at the top of the record being edited. */
export interface EditedRecord {
  archived: boolean
  heading: string
  /** Works only: what archiving leaves in place, recalled in the confirmation. */
  impact?: ArchiveImpact
}

/** Loads, edits, saves and archives one record; the draft lives in shared state. */
export function useAdminEditor(kind: AdminKind, id: number | 'new') {
  const client = useAdminClient()
  const api = useApi()

  // `useState`: the draft loaded during server rendering is picked up as is by the browser.
  /** Key of one piece of the editor state, unique per record. */
  const stateKey = (name: string) => `admin-${name}-${kind}-${id}`
  const work = useState<WorkDraft>(stateKey('work'), emptyWorkDraft)
  const person = useState<PersonDraft>(stateKey('person'), emptyPersonDraft)
  const publisher = useState<PublisherDraft>(stateKey('publisher'), emptyPublisherDraft)
  const record = useState<EditedRecord | null>(stateKey('record'), () => null)
  const errorKey = ref<string>()
  const saving = ref(false)

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
        heading: loaded.title,
        impact: archiveImpact(loaded),
      }
    } else if (kind === 'people') {
      const loaded = await client.get<AdminPerson>(kind, id)
      person.value = personToDraft(loaded)
      record.value = { archived: loaded.archived, heading: loaded.name }
    } else {
      const loaded = await client.get<AdminPublisher>(kind, id)
      publisher.value = publisherToDraft(loaded)
      record.value = { archived: loaded.archived, heading: loaded.name }
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

  /** Saves; true if the API accepted, otherwise `errorKey` says why. */
  async function save(): Promise<boolean> {
    errorKey.value = undefined
    if (kind === 'works' && hasIncompleteRows(work.value)) {
      errorKey.value = INCOMPLETE_ROWS_ERROR_KEY
      return false
    }
    saving.value = true
    try {
      if (id === 'new') await client.create(kind, body())
      else await client.replace(kind, id, body())
      markSaved()
      return true
    } catch (cause) {
      errorKey.value = adminErrorKey(cause, api.messageKeyFor)
      return false
    } finally {
      saving.value = false
    }
  }

  /** Archives or restores the record; true if the API accepted. */
  async function setArchived(archived: boolean): Promise<boolean> {
    if (id === 'new') return false
    errorKey.value = undefined
    try {
      await (archived ? client.archive(kind, id) : client.restore(kind, id))
      if (record.value) record.value = { ...record.value, archived }
      return true
    } catch (cause) {
      errorKey.value = adminErrorKey(cause, api.messageKeyFor)
      return false
    }
  }

  return {
    work,
    person,
    publisher,
    record,
    errorKey,
    saving,
    isDirty,
    load,
    save,
    setArchived,
    client,
  }
}
