import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

/** Observateur piloté par le test : il ne se déclenche que quand on appelle `reveal`. */
class FakeIntersectionObserver {
  static latest: FakeIntersectionObserver
  readonly disconnect = vi.fn()

  constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeIntersectionObserver.latest = this
  }

  observe() {}

  reveal(isIntersecting = true) {
    this.callback([{ isIntersecting }])
  }
}

function fakeList(pagesLeft: number) {
  const remaining = ref(pagesLeft)
  return {
    hasMore: computed(() => remaining.value > 0),
    hasLoadMoreFailed: ref(false),
    loadMore: vi.fn(() => {
      remaining.value -= 1
      return Promise.resolve()
    }),
  }
}

// Monte le composable dans un composant, le repère sous la liste comme dans les pages.
function mountWithSentinel(list: ReturnType<typeof fakeList>) {
  const Probe = defineComponent({
    setup() {
      const sentinel = useLoadMoreOnScroll(list)
      return () => h('div', { ref: sentinel })
    },
  })
  return mountSuspended(Probe)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useLoadMoreOnScroll', () => {
  it('charge des pages tant que le repère reste à l’écran, puis s’arrête', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    const list = fakeList(2)
    const wrapper = await mountWithSentinel(list)

    FakeIntersectionObserver.latest.reveal()

    await vi.waitFor(() => expect(list.loadMore).toHaveBeenCalledTimes(2))
    wrapper.unmount()
    expect(FakeIntersectionObserver.latest.disconnect).toHaveBeenCalled()
  })

  it('ne charge rien quand le repère sort de l’écran ou après un échec', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    const list = fakeList(2)
    await mountWithSentinel(list)

    FakeIntersectionObserver.latest.reveal(false)
    list.hasLoadMoreFailed.value = true
    FakeIntersectionObserver.latest.reveal()

    expect(list.loadMore).not.toHaveBeenCalled()
  })
})
