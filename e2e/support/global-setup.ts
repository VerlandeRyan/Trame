/** Playwright global setup: reloads the demo data into the test database. */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Reloads the fictitious demo data set into the TEST database before the journeys run. The API's
 * script refuses any non-local host and empties the tables: never the working database.
 */
export default function globalSetup() {
  const api = fileURLToPath(new URL('../../api/', import.meta.url))
  execFileSync(process.execPath, ['scripts/seed.mjs'], { cwd: api, stdio: 'inherit' })
}
