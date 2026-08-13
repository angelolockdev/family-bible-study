import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateCatalogues } from './catalogue-pipeline.mjs'

const filePath = resolve(process.argv[2] ?? 'src/data/watchtower-studies.json')
const studies = JSON.parse(readFileSync(filePath, 'utf8'))
const errors = validateCatalogues([], studies)

if (errors.length > 0) {
  console.error(`Validation Watchtower échouée (${filePath}) :`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Validation Watchtower réussie : ${studies.length} étude(s), sources et structure conformes.`)
