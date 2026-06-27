/**
 * UI Mode força live trace com screenshots; no Windows isso trava no teardown (timeout 60s).
 * Reaplica o patch após yarn install (node_modules é regenerado).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const testRunnerPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'playwright',
  'lib',
  'runner',
  'testRunner.js',
)

const original =
  '...params.trace === "on" ? { trace: { mode: "on", sources: false, _live: true } } : {},'
const patched =
  '...params.trace === "on" ? { trace: { mode: "on", sources: false, screenshots: false, snapshots: false, attachments: false, _live: true } } : {},'

if (!fs.existsSync(testRunnerPath)) {
  console.warn('[patch-playwright-ui-trace] testRunner.js not found, skipping')
  process.exit(0)
}

const source = fs.readFileSync(testRunnerPath, 'utf8')

if (source.includes(patched)) {
  process.exit(0)
}

if (!source.includes(original)) {
  console.warn('[patch-playwright-ui-trace] pattern not found — Playwright version may have changed')
  process.exit(0)
}

fs.writeFileSync(testRunnerPath, source.replace(original, patched))
console.log('[patch-playwright-ui-trace] applied UI Mode live trace fix')
