import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Recharge le jeu de démonstration fictif (db/demo-data.sql) dans la base de TEST avant les parcours.
// Le script de l'API refuse tout hôte qui n'est pas local et vide les tables : jamais la base de travail.
export default function globalSetup() {
  const api = fileURLToPath(new URL('../../api/', import.meta.url))
  execFileSync(process.execPath, ['scripts/seed.mjs'], { cwd: api, stdio: 'inherit' })
}
