/** The server-rendered layout must not move once the page hydrates (no jump on reload). */
import { expect, test, type Page } from '@playwright/test'
import { waitForHydration } from '../support/hydration.js'

type Box = [x: number, y: number, width: number, height: number]

/**
 * Rounded box of every visible element of the header and the main area, keyed by tag, first class
 * and rank among its twins, so a moved or resized element is reported by name.
 */
async function measureLayout(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const seen: Record<string, number> = {}
    const boxes: Record<string, Box> = {}
    for (const element of document.querySelectorAll('header *, main *')) {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const firstClass =
        typeof element.className === 'string' ? element.className.split(' ')[0] : ''
      const base = `${element.tagName}.${firstClass}`
      seen[base] = (seen[base] ?? 0) + 1
      boxes[`${base}#${seen[base]}`] = [
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height),
      ]
    }
    return boxes
  })
}

// Pages whose shared components (`.panel`…) are restyled by a page class of the same specificity:
// the winner depends on the order of the stylesheets, which must be the same on both sides.
for (const path of ['/', '/search?q=basalte']) {
  test(`la mise en page ne bouge pas à l’hydratation : ${path}`, async ({ browser, baseURL }) => {
    const viewport = { width: 390, height: 844 }

    const serverContext = await browser.newContext({ baseURL, viewport, javaScriptEnabled: false })
    const serverPage = await serverContext.newPage()
    await serverPage.goto(path)
    const beforeHydration = await measureLayout(serverPage)
    await serverContext.close()

    const clientContext = await browser.newContext({ baseURL, viewport })
    const clientPage = await clientContext.newPage()
    await clientPage.goto(path)
    await waitForHydration(clientPage)
    const afterHydration = await measureLayout(clientPage)
    await clientContext.close()

    const moved = Object.keys(beforeHydration).filter(
      (key) => String(beforeHydration[key]) !== String(afterHydration[key]),
    )
    expect(moved.map((key) => [key, beforeHydration[key], afterHydration[key]])).toEqual([])
  })
}
