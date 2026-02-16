import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

function normalizePath(pathValue) {
  return pathValue.replace(/\\/g, '/').replace(/^\.\//, '')
}

function collectExportTargets(value, label, targets) {
  if (typeof value === 'string') {
    targets.push([label, value])
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextLabel = `${label}.${key}`
    collectExportTargets(nested, nextLabel, targets)
  }
}

function isJsOrTypesEntrypoint(pathValue) {
  return /\.(?:[cm]?js|d\.[cm]?ts|ts|tsx)$/.test(pathValue)
}

function parsePackOutput(stdout) {
  const trimmed = stdout.trim()
  const jsonStart = trimmed.indexOf('[')

  if (jsonStart === -1) {
    throw new Error('`npm pack --dry-run --json` did not return JSON output.')
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart))

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0]?.files) {
    throw new Error('`npm pack --dry-run --json` returned an unexpected payload.')
  }

  return parsed[0]
}

function main() {
  const pkgPath = resolve(process.cwd(), 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  const rawTargets = []

  if (typeof pkg.main === 'string') rawTargets.push(['main', pkg.main])
  if (typeof pkg.module === 'string') rawTargets.push(['module', pkg.module])
  if (typeof pkg.types === 'string') rawTargets.push(['types', pkg.types])

  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const [key, exportValue] of Object.entries(pkg.exports)) {
      collectExportTargets(exportValue, `exports:${key}`, rawTargets)
    }
  }

  const jsAndTypesTargets = rawTargets
    .map(([label, target]) => [label, normalizePath(target)])
    .filter(([, target]) => isJsOrTypesEntrypoint(target))

  const packStdout = execSync('npm pack --dry-run --json --ignore-scripts', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const packMetadata = parsePackOutput(packStdout)
  const packedFiles = new Set(packMetadata.files.map((entry) => normalizePath(entry.path)))
  const sourcemapFiles = packMetadata.files
    .map((entry) => normalizePath(entry.path))
    .filter((pathValue) => pathValue.endsWith('.map'))

  const errors = []

  for (const [label, target] of jsAndTypesTargets) {
    if (target.startsWith('src/')) {
      errors.push(`${label} points at source file "${target}". Use dist output instead.`)
    }

    if (!packedFiles.has(target)) {
      errors.push(`${label} points at "${target}" which is missing from npm tarball.`)
    }
  }

  if (sourcemapFiles.length > 0) {
    errors.push(
      `npm tarball contains sourcemaps: ${sourcemapFiles.join(', ')}. Sourcemaps must not be shipped.`
    )
  }

  if (errors.length > 0) {
    console.error('Package verification failed:')
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(
    `Package verification passed. Checked ${jsAndTypesTargets.length} JS/types targets; no sourcemaps found in tarball.`
  )
}

main()
