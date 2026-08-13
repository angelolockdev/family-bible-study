import { access, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ALLOWED_HOSTS = new Set(['jw.org', 'www.jw.org'])
const PLACEHOLDER_PATTERN = /\bTODO\b|à hydrater|a hydrater|placeholder|texte à compléter|text to fill/i
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const FAMILY_DAYS = ['Alatsinainy', 'Talata', 'Alarobia', 'Alakamisy', 'Zoma', 'Sabotsy', 'Alahady']

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidIsoDate(value) {
  if (!isNonEmptyString(value) || !ISO_DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function isAllowedJwUrl(value) {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return false
    return url.pathname.startsWith('/mg/') || (url.pathname === '/finder' && url.searchParams.get('wtlocale') === 'MG')
  } catch {
    return false
  }
}

function hasPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(hasPlaceholder)
  if (isRecord(value)) return Object.values(value).some(hasPlaceholder)
  return false
}

function pushRequiredStringErrors(item, fields, label, errors) {
  for (const field of fields) {
    if (!isNonEmptyString(item[field])) errors.push(`${label} : champ obligatoire vide (${field})`)
  }
}

function validatePeriod(item, label, errors) {
  if (!isValidIsoDate(item.startDate)) errors.push(`${label} : date ISO invalide (startDate)`)
  if (!isValidIsoDate(item.endDate)) errors.push(`${label} : date ISO invalide (endDate)`)
  if (isValidIsoDate(item.startDate) && isValidIsoDate(item.endDate) && item.startDate > item.endDate) {
    errors.push(`${label} : startDate doit précéder endDate`)
  }
}

function validateVerse(verse, label, errors) {
  if (!isRecord(verse)) {
    errors.push(`${label} : passage biblique absent`)
    return
  }
  pushRequiredStringErrors(verse, ['reference', 'application', 'url'], label, errors)
  if (isNonEmptyString(verse.url) && !isAllowedJwUrl(verse.url)) errors.push(`${label} : URL hors domaine jw.org malagasy`)
}

function assertUnique(items, valueOf, label, errors) {
  const seen = new Set()
  for (const item of items) {
    let value
    try {
      value = valueOf(item)
    } catch {
      continue
    }
    if (value === undefined || value === null || value === '') continue
    if (seen.has(value)) errors.push(`${label} dupliqué : ${value}`)
    seen.add(value)
  }
}

function sortedStudies(studies) {
  return [...studies].sort((first, second) => {
    const kindOrder = { family: 0, preaching: 1 }
    return (kindOrder[first?.kind] ?? 99) - (kindOrder[second?.kind] ?? 99)
      || String(first?.startDate ?? '').localeCompare(String(second?.startDate ?? ''))
      || String(first?.id ?? '').localeCompare(String(second?.id ?? ''))
  })
}

function sortedWatchtower(studies) {
  return [...studies].sort((first, second) => Number(second?.documentId ?? 0) - Number(first?.documentId ?? 0))
}

function sameOrder(items, sorted) {
  return items.length === sorted.length && items.every((item, index) => item === sorted[index])
}

export function canonicalizeCatalogues(studies, watchtowerStudies) {
  return {
    studies: sortedStudies(studies),
    watchtowerStudies: sortedWatchtower(watchtowerStudies),
  }
}

export function validateCatalogues(studies, watchtowerStudies) {
  const errors = []
  if (!Array.isArray(studies)) errors.push('studies.json doit être un tableau JSON')
  if (!Array.isArray(watchtowerStudies)) errors.push('watchtower-studies.json doit être un tableau JSON')
  if (!Array.isArray(studies) || !Array.isArray(watchtowerStudies)) return errors

  assertUnique(studies, (study) => study.id, 'id', errors)
  assertUnique(
    studies,
    (study) => `${study.kind}:${study.startDate}:${study.endDate}`,
    'période hebdomadaire',
    errors,
  )
  if (!sameOrder(studies, sortedStudies(studies))) errors.push('studies.json : ordre déterministe attendu (family puis preaching, dates croissantes)')

  for (const study of studies) {
    const label = study?.id ?? 'étude sans id'
    if (!isRecord(study)) {
      errors.push('studies.json : entrée invalide')
      continue
    }
    pushRequiredStringErrors(study, ['id', 'kind', 'startDate', 'endDate', 'weekLabel', 'sourceUrl'], label, errors)
    validatePeriod(study, label, errors)
    if (!isAllowedJwUrl(study.sourceUrl)) errors.push(`${label} : URL source hors domaine jw.org malagasy`)
    if (hasPlaceholder(study)) errors.push(`${label} : placeholder interdit`)

    if (study.kind === 'family') {
      if (study.id !== `family-${study.startDate}`) errors.push(`${label} : id incohérent avec startDate`)
      pushRequiredStringErrors(study, ['reading', 'theme', 'printPrompt'], label, errors)
      if (!Array.isArray(study.days) || study.days.length !== 7) {
        errors.push(`${label} : une étude familiale doit contenir sept jours`)
      } else {
        const dayNames = study.days.map((day) => day?.day)
        if (new Set(dayNames).size !== 7 || FAMILY_DAYS.some((day) => !dayNames.includes(day))) {
          errors.push(`${label} : jours familiaux incomplets ou dupliqués`)
        }
        study.days.forEach((day, index) => pushRequiredStringErrors(day ?? {}, ['day', 'focus'], `${label} jour ${index + 1}`, errors))
      }
      validateVerse(study.memoryVerse, `${label} memoryVerse`, errors)
      if (study.guidedSuggestions !== undefined) {
        if (!Array.isArray(study.guidedSuggestions)) {
          errors.push(`${label} : guidedSuggestions doit être un tableau`)
        } else {
          const questionIds = new Set((study.days ?? []).map((_, index) => `${study.id}-question-${index}`))
          assertUnique(study.guidedSuggestions, (suggestion) => suggestion?.questionId, `questionId de soso-kevitra de ${label}`, errors)
          study.guidedSuggestions.forEach((suggestion, index) => {
            const suggestionLabel = `${label} soso-kevitra ${index + 1}`
            if (!isRecord(suggestion)) {
              errors.push(`${suggestionLabel} : entrée invalide`)
              return
            }
            pushRequiredStringErrors(suggestion, ['questionId', 'text', 'sourceUrl'], suggestionLabel, errors)
            if (!questionIds.has(suggestion.questionId)) errors.push(`${suggestionLabel} : questionId inconnu`)
            if (!isAllowedJwUrl(suggestion.sourceUrl)) errors.push(`${suggestionLabel} : URL hors domaine jw.org malagasy`)
          })
        }
      }
    } else if (study.kind === 'preaching') {
      if (study.id !== `preaching-${study.startDate}`) errors.push(`${label} : id incohérent avec startDate`)
      pushRequiredStringErrors(
        study,
        ['publishedAt', 'title', 'subtitle', 'objective', 'theme', 'opening', 'question', 'response', 'nextStep', 'practice'],
        label,
        errors,
      )
      validateVerse(study.scripture, `${label} scripture`, errors)
    } else {
      errors.push(`${label} : kind inconnu (${study.kind})`)
    }
  }

  assertUnique(watchtowerStudies, (study) => study.id, 'id Watchtower', errors)
  assertUnique(watchtowerStudies, (study) => String(study.documentId), 'documentId', errors)
  assertUnique(watchtowerStudies, (study) => `${study.startDate}:${study.endDate}`, 'période Watchtower', errors)
  if (!sameOrder(watchtowerStudies, sortedWatchtower(watchtowerStudies))) {
    errors.push('watchtower-studies.json : ordre déterministe attendu (documentId décroissant)')
  }

  for (const study of watchtowerStudies) {
    const label = study?.id ?? 'Watchtower sans id'
    if (!isRecord(study)) {
      errors.push('watchtower-studies.json : entrée invalide')
      continue
    }
    pushRequiredStringErrors(study, ['id', 'title', 'weekLabel', 'startDate', 'endDate', 'sourceUrl', 'sourceDigest', 'generatedAt', 'model'], label, errors)
    validatePeriod(study, label, errors)
    if (!Number.isInteger(study.documentId)) errors.push(`${label} : documentId invalide`)
    if (study.id !== `watchtower-${study.documentId}`) errors.push(`${label} : id incohérent avec documentId`)
    if (!isAllowedJwUrl(study.sourceUrl)) errors.push(`${label} : URL source hors domaine jw.org malagasy`)
    if (!isNonEmptyString(study.sourceDigest) || !/^[a-f0-9]{64}$/i.test(study.sourceDigest)) errors.push(`${label} : sourceDigest doit être un SHA-256 hexadécimal`)
    if (hasPlaceholder(study)) errors.push(`${label} : placeholder interdit`)
    if (!Array.isArray(study.questions) || study.questions.length === 0) {
      errors.push(`${label} : questions absentes`)
      continue
    }
    assertUnique(study.questions, (question) => question.id, `id de question de ${study.documentId}`, errors)
    assertUnique(study.questions, (question) => question.number, `numéro de question de ${study.documentId}`, errors)
    for (const question of study.questions) {
      const questionLabel = question?.id ?? `${label} question sans id`
      if (!isRecord(question)) {
        errors.push(`${questionLabel} : entrée invalide`)
        continue
      }
      pushRequiredStringErrors(question, ['id', 'number', 'text', 'answer'], questionLabel, errors)
      if (!Array.isArray(question.paragraphNumbers)) errors.push(`${questionLabel} : paragraphNumbers doit être un tableau`)
      if (question.paragraphs !== undefined) errors.push(`${questionLabel} : paragraphs est interdit dans le catalogue public`)
      if (!Array.isArray(question.references)) {
        errors.push(`${questionLabel} : references doit être un tableau`)
        continue
      }
      for (const reference of question.references) {
        if (!isRecord(reference)) {
          errors.push(`${questionLabel} référence : entrée invalide`)
          continue
        }
        pushRequiredStringErrors(reference, ['label', 'url'], `${questionLabel} référence`, errors)
        if (!isAllowedJwUrl(reference.url)) errors.push(`${questionLabel} : URL de référence hors domaine jw.org malagasy`)
        if ('excerpt' in reference && !isNonEmptyString(reference.excerpt)) errors.push(`${questionLabel} : extrait vide interdit`)
        if (hasPlaceholder(reference.excerpt)) errors.push(`${questionLabel} : placeholder interdit dans un extrait`)
      }
    }
  }

  return errors
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function replaceFilesTransaction(files, cleanupBackup = (path) => rm(path, { force: true })) {
  const token = `${process.pid}-${Date.now()}`
  const prepared = []
  try {
    for (const file of files) {
      if (!file.changed) continue
      const tempPath = resolve(dirname(file.path), `.${file.path.split(/[\\/]/).at(-1)}.${token}.tmp`)
      const backupPath = `${file.path}.${token}.bak`
      await writeFile(tempPath, file.content, 'utf8')
      prepared.push({ ...file, tempPath, backupPath, hadOriginal: await exists(file.path), replaced: false })
    }

    for (const file of prepared) {
      if (file.hadOriginal) await rename(file.path, file.backupPath)
      await rename(file.tempPath, file.path)
      file.replaced = true
    }

    await Promise.all(prepared.map(async (file) => {
      try {
        await cleanupBackup(file.backupPath)
      } catch {
        // Backup cleanup happens after commit and must never trigger rollback.
      }
    }))
  } catch (error) {
    for (const file of [...prepared].reverse()) {
      await rm(file.tempPath, { force: true }).catch(() => undefined)
      if (file.replaced) await rm(file.path, { force: true }).catch(() => undefined)
      if (file.hadOriginal && await exists(file.backupPath)) await rename(file.backupPath, file.path).catch(() => undefined)
    }
    throw error
  }
}

export async function applyCatalogueUpdate({ studiesPath, watchtowerPath, studies, watchtowerStudies, cleanupBackup }) {
  const canonical = canonicalizeCatalogues(studies, watchtowerStudies)
  const errors = validateCatalogues(canonical.studies, canonical.watchtowerStudies)
  if (errors.length > 0) throw new Error(`Validation des catalogues échouée :\n- ${errors.join('\n- ')}`)

  const studiesContent = `${JSON.stringify(canonical.studies, null, 2)}\n`
  const watchtowerContent = `${JSON.stringify(canonical.watchtowerStudies, null, 2)}\n`
  const currentStudies = await readFile(studiesPath, 'utf8').catch(() => '')
  const currentWatchtower = await readFile(watchtowerPath, 'utf8').catch(() => '')
  const files = [
    { path: studiesPath, content: studiesContent, changed: currentStudies !== studiesContent },
    { path: watchtowerPath, content: watchtowerContent, changed: currentWatchtower !== watchtowerContent },
  ]

  if (!files.some((file) => file.changed)) return { changed: false }
  await replaceFilesTransaction(files, cleanupBackup)
  return { changed: true }
}

async function runCli() {
  const args = new Map()
  for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])
  const candidateStudiesPath = args.get('--studies')
  const candidateWatchtowerPath = args.get('--watchtower')
  if (!candidateStudiesPath || !candidateWatchtowerPath) {
    throw new Error('Usage: node scripts/catalogue-pipeline.mjs --studies <candidate-studies.json> --watchtower <candidate-watchtower.json>')
  }
  const studies = JSON.parse(await readFile(resolve(candidateStudiesPath), 'utf8'))
  const watchtowerStudies = JSON.parse(await readFile(resolve(candidateWatchtowerPath), 'utf8'))
  const result = await applyCatalogueUpdate({
    studiesPath: resolve('src/data/studies.json'),
    watchtowerPath: resolve('src/data/watchtower-studies.json'),
    studies,
    watchtowerStudies,
  })
  console.log(result.changed ? 'Catalogues validés et mis à jour.' : 'Catalogues déjà à jour, aucune écriture.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
