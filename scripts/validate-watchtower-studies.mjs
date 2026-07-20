import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const filePath = resolve(process.argv[2] ?? 'src/data/watchtower-studies.json')
const studies = JSON.parse(readFileSync(filePath, 'utf8'))
const errors = []

function assertUnique(items, valueOf, label) {
  const seen = new Set()
  for (const item of items) {
    const value = valueOf(item)
    if (seen.has(value)) errors.push(`${label} dupliqué : ${value}`)
    seen.add(value)
  }
}

if (!Array.isArray(studies)) {
  errors.push('Le catalogue doit être un tableau JSON.')
} else {
  assertUnique(studies, (study) => study.id, 'id d’étude')
  assertUnique(studies, (study) => String(study.documentId), 'documentId')
  assertUnique(studies, (study) => `${study.startDate}:${study.endDate}`, 'semaine')

  for (const study of studies) {
    if (study.id !== `watchtower-${study.documentId}`) errors.push(`id incohérent pour documentId ${study.documentId}`)
    if (!Array.isArray(study.questions) || study.questions.length === 0) errors.push(`questions absentes pour documentId ${study.documentId}`)
    if (!Array.isArray(study.questions)) continue
    assertUnique(study.questions, (question) => question.id, `id de question de ${study.documentId}`)
    assertUnique(study.questions, (question) => question.number, `numéro de question de ${study.documentId}`)
    for (const question of study.questions) {
      for (const reference of question.references ?? []) {
        if (typeof reference.excerpt !== 'string' || reference.excerpt.trim().length === 0) {
          errors.push(`extrait biblique absent pour ${question.id} : ${reference.label ?? reference.url}`)
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Validation Watchtower échouée (${filePath}) :`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Validation Watchtower réussie : ${studies.length} étude(s), sans doublon.`)
