// Same file in ecos-api and ecos-literarios: change both together.
// Fails on high and critical advisories, except an accepted one, and only while every path to it is a dev dependency
// and the review date has not passed. Yarn 1 has no way to accept a single advisory.
import { spawnSync } from 'node:child_process'

const ACCEPTED = [
  {
    advisory: 'GHSA-vfj7-8cjw-p6xm',
    until: '2026-11-03',
    reason:
      'braces: no patched version. Reached only through build and lint tools (tsc-alias, stylelint, eslint ' +
      'config), which expand glob patterns we write; nothing in the served app or the API expands outside input.',
  },
]

const today = new Date().toISOString().slice(0, 10)
// The yarn that runs this script (`yarn audit:check`), not whatever `yarn` the PATH finds.
const yarn = process.env.npm_execpath
if (!yarn) {
  console.error('Rode pelo yarn: yarn audit:check')
  process.exit(1)
}
const run = spawnSync(process.execPath, [yarn, 'audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
if (run.error) {
  console.error('Não foi possível rodar o yarn audit:', run.error.message)
  process.exit(1)
}

const failing = []
const accepted = new Set()
for (const line of run.stdout.split('\n')) {
  if (!line.trim()) continue
  const entry = JSON.parse(line)
  if (entry.type !== 'auditAdvisory') continue
  const { advisory, resolution } = entry.data
  if (!['high', 'critical'].includes(advisory.severity)) continue
  const rule = ACCEPTED.find((one) => one.advisory === advisory.github_advisory_id)
  if (rule && resolution.dev && today <= rule.until) {
    accepted.add(`${rule.advisory} (até ${rule.until}): ${rule.reason}`)
    continue
  }
  failing.push(
    `${advisory.severity} ${advisory.module_name} ${advisory.github_advisory_id} via ${resolution.path}`,
  )
}

for (const note of accepted) console.log(`Aceito: ${note}`)
if (failing.length) {
  console.error(`Avisos altos ou críticos:\n${[...new Set(failing)].join('\n')}`)
  process.exit(1)
}
console.log('Nenhum aviso alto ou crítico fora dos aceitos.')
