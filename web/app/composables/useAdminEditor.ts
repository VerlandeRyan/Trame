import type { ArchiveImpact } from '~/utils/admin'

/** Ce qui s'affiche en tête de la fiche en cours d'édition. */
export interface EditedRecord {
  archived: boolean
  heading: string
  /** Œuvre seulement : ce que l'archivage laisse en place, rappelé dans la confirmation. */
  impact?: ArchiveImpact
}

// État d'édition d'une fiche du catalogue (œuvre, personne ou éditeur), nouvelle ou existante.
export function useAdminEditor(kind: AdminKind, id: number | 'new') {
  const client = useAdminClient()
  const api = useApi()

  // `useState` : le brouillon chargé au rendu serveur est repris tel quel par le navigateur.
  const stateKey = (name: string) => `admin-${name}-${kind}-${id}`
  const work = useState<WorkDraft>(stateKey('work'), emptyWorkDraft)
  const person = useState<PersonDraft>(stateKey('person'), emptyPersonDraft)
  const publisher = useState<PublisherDraft>(stateKey('publisher'), emptyPublisherDraft)
  const record = useState<EditedRecord | null>(stateKey('record'), () => null)
  const errorKey = ref<string>()
  const saving = ref(false)

  // Une fiche neuve repart toujours à vide : l'état survit à la navigation dans le site.
  if (id === 'new') {
    work.value = emptyWorkDraft()
    person.value = emptyPersonDraft()
    publisher.value = emptyPublisherDraft()
  }

  const currentDraft = () => {
    if (kind === 'works') return work.value
    return kind === 'people' ? person.value : publisher.value
  }

  // Dernier état enregistré (ou chargé), pour savoir si la saisie a changé.
  const savedSnapshot = ref(JSON.stringify(currentDraft()))
  const isDirty = computed(() => JSON.stringify(currentDraft()) !== savedSnapshot.value)
  const markSaved = () => (savedSnapshot.value = JSON.stringify(currentDraft()))

  async function load() {
    if (id === 'new') return
    if (kind === 'works') {
      const loaded = await client.get<AdminWork>(kind, id)
      work.value = workToDraft(loaded, await client.loadLabels(loaded))
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

  const body = () => {
    if (kind === 'works') return draftToWorkBody(work.value)
    return kind === 'people'
      ? draftToPersonBody(person.value)
      : draftToPublisherBody(publisher.value)
  }

  /** Enregistre ; vrai si l'API a accepté, sinon `errorKey` dit pourquoi. */
  async function save(): Promise<boolean> {
    errorKey.value = undefined
    if (kind === 'works' && hasIncompleteRows(work.value)) {
      errorKey.value = 'admin.error.incompleteRows'
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

  /** Archive ou restaure la fiche ; vrai si l'API a accepté. */
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
