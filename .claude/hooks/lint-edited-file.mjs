// Hook Claude Code (PostToolUse) : après chaque modification d'un fichier .ts ou .vue d'api/, web/
// ou e2e/, lance ESLint (règles sonarjs, lint typé) sur ce seul fichier. En cas d'alerte, le code
// de sortie 2 renvoie le rapport à l'assistant, qui corrige avant de continuer.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const PACKAGES = new Set(['api', 'web', 'e2e'])
const LINTED_EXTENSIONS = /\.(ts|vue)$/
const SKIPPED_FOLDERS = /(^|[\\/])(node_modules|dist|dist-e2e|\.nuxt|\.output|coverage)[\\/]/

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
// Un shell Windows peut préfixer l'entrée d'un BOM, que JSON.parse refuse.
const input = JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''))
const editedFile = input.tool_response?.filePath ?? input.tool_input?.file_path

function lintTarget(file) {
  if (!file || !LINTED_EXTENSIONS.test(file) || SKIPPED_FOLDERS.test(file)) return null
  const [packageName, ...rest] = relative(projectDir, resolve(file)).split(sep)
  if (!PACKAGES.has(packageName) || rest.length === 0) return null
  return { cwd: resolve(projectDir, packageName), file: rest.join('/') }
}

const target = lintTarget(editedFile)
if (!target) process.exit(0)

// L'ESLint du dossier, lancé par le Node courant : aucun exécutable n'est cherché dans le PATH.
const eslintBin = resolve(target.cwd, 'node_modules', 'eslint', 'bin', 'eslint.js')
const result = spawnSync(process.execPath, [eslintBin, target.file], {
  cwd: target.cwd,
  encoding: 'utf8',
})
if (result.status === 0) process.exit(0)

process.stderr.write(
  `ESLint (règles Sonar) signale des problèmes dans ${editedFile} : corrige-les.\n${result.stdout}${result.stderr}`,
)
process.exit(2)
