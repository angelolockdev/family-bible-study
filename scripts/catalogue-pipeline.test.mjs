import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { applyCatalogueUpdate, validateCatalogues } from './catalogue-pipeline.mjs'

const sourceUrl = 'https://www.jw.org/mg/zavatra-misy/fivoriana-vj-tari-dalana/'
const scriptureUrl = 'https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/jeremia/1/'

function family(startDate = '2026-08-10') {
  return {
    id: `family-${startDate}`,
    kind: 'family',
    startDate,
    endDate: '2026-08-16',
    weekLabel: '10-16 Aogositra 2026',
    reading: 'Jeremia 24-25',
    theme: 'Miezaha hihaino',
    days: [
      'Alatsinainy',
      'Talata',
      'Alarobia',
      'Alakamisy',
      'Zoma',
      'Sabotsy',
      'Alahady',
    ].map((day) => ({ day, focus: `${day}: Jeremia 24:1` })),
    memoryVerse: { reference: 'Jeremia 24:7', application: 'Ampiharo.', url: scriptureUrl },
    sourceUrl,
    printPrompt: 'Create one printable family activity sheet.',
    generatedAt: '2026-08-09T15:00:00Z',
  }
}

function preaching(startDate = '2026-08-14') {
  return {
    id: `preaching-${startDate}`,
    kind: 'preaching',
    startDate,
    endDate: '2026-08-15',
    weekLabel: '14-15 Aogositra 2026',
    publishedAt: '14 Aogositra 2026, 19:00',
    title: "Fianarana ho an'ny fanompoana",
    subtitle: 'Fanomanana fohy.',
    objective: 'Hihaino tsara.',
    theme: 'Ahoana no atao?',
    opening: 'Manao ahoana.',
    question: 'Inona no hevitrao?',
    scripture: { reference: 'Jeremia 24:7', application: 'Ampiharo.', url: scriptureUrl },
    response: 'Henoy ilay olona.',
    nextStep: 'Miverena amin-katsaram-panahy.',
    practice: 'Manaova fanazaran-tena.',
    sourceUrl,
    generatedAt: '2026-08-09T15:00:00Z',
  }
}

function watchtower(documentId = 2026442) {
  return {
    id: `watchtower-${documentId}`,
    documentId,
    title: 'Lohateny marina',
    weekLabel: '10-16 Aogositra 2026',
    startDate: '2026-08-10',
    endDate: '2026-08-16',
    sourceUrl: `https://www.jw.org/finder?docid=${documentId}&wtlocale=MG`,
    sourceDigest: 'a'.repeat(64),
    generatedAt: '2026-08-09T15:00:00Z',
    model: 'gpt-5.6-terra',
    questions: [{
      id: `${documentId}-q1`,
      number: '1',
      text: 'Inona no ianarantsika?',
      paragraphNumbers: ['1'],
      answer: 'Valiny mifototra amin’ny lahatsoratra.',
      references: [{ label: 'Jeremia 24:7', url: scriptureUrl, excerpt: 'Homena fo hahalalana ahy izy ireo.' }],
    }],
  }
}

test('validates both catalogues and rejects duplicates, unofficial sources, and placeholders', () => {
  assert.deepEqual(validateCatalogues([family(), preaching()], [watchtower()]), [])

  const errors = validateCatalogues(
    [family(), family(), { ...preaching(), sourceUrl: 'https://example.com/source' }],
    [{ ...watchtower(), questions: [{ ...watchtower().questions[0], answer: 'TODO', references: [{ label: 'Jeremia 24:7', url: scriptureUrl, excerpt: 'À hydrater' }] }] }],
  )

  assert.ok(errors.some((error) => error.includes('id dupliqué')))
  assert.ok(errors.some((error) => error.includes('domaine jw.org')))
  assert.ok(errors.some((error) => error.includes('placeholder')))
})

test('rejects invalid dates, mismatched ids, incomplete family weeks, and nondeterministic order', () => {
  const invalidFamily = { ...family('2026-08-11'), id: 'family-2026-08-10', endDate: '2026-08-10', days: family().days.slice(0, 6) }
  const errors = validateCatalogues(
    [preaching(), invalidFamily],
    [watchtower(2026442), { ...watchtower(2026404), startDate: 'not-a-date' }],
  )

  assert.ok(errors.some((error) => error.includes('ordre déterministe')))
  assert.ok(errors.some((error) => error.includes('id incohérent')))
  assert.ok(errors.some((error) => error.includes('sept jours')))
  assert.ok(errors.some((error) => error.includes('date ISO')))
})

test('reports malformed entries without crashing the validator', () => {
  const errors = validateCatalogues([null], [null])

  assert.ok(errors.some((error) => error.includes('entrée invalide')))
  assert.doesNotThrow(() => validateCatalogues([42], ['invalid']))

  const malformedQuestion = watchtower()
  malformedQuestion.questions = [null]
  assert.doesNotThrow(() => validateCatalogues([family(), preaching()], [malformedQuestion]))

  const malformedReference = watchtower()
  malformedReference.questions[0].references = [null]
  assert.doesNotThrow(() => validateCatalogues([family(), preaching()], [malformedReference]))
})

test('validates guided suggestions against family question ids and official sources', () => {
  const validFamily = family()
  validFamily.guidedSuggestions = [{
    questionId: `${validFamily.id}-question-0`,
    text: 'Soso-kevitra voamarina.',
    sourceUrl,
  }]
  assert.deepEqual(validateCatalogues([validFamily, preaching()], [watchtower()]), [])

  validFamily.guidedSuggestions[0].questionId = 'unknown-question'
  validFamily.guidedSuggestions[0].sourceUrl = 'https://example.com/suggestion'
  const errors = validateCatalogues([validFamily, preaching()], [watchtower()])
  assert.ok(errors.some((error) => error.includes('questionId')))
  assert.ok(errors.some((error) => error.includes('soso-kevitra') && error.includes('jw.org')))
})

test('rejects full Watchtower paragraphs and invalid source digests in the public catalogue', () => {
  const withParagraphs = watchtower()
  withParagraphs.questions[0].paragraphs = ['Paragrafy ofisialy voamarina.']
  withParagraphs.sourceDigest = 'invalid'
  const errors = validateCatalogues([family(), preaching()], [withParagraphs])
  assert.ok(errors.some((error) => error.includes('paragraphs') && error.includes('interdit')))
  assert.ok(errors.some((error) => error.includes('sourceDigest')))
})

test('applies a validated update once and leaves files byte-identical on a second run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'family-bible-study-'))
  const studiesPath = join(directory, 'studies.json')
  const watchtowerPath = join(directory, 'watchtower-studies.json')
  await writeFile(studiesPath, '[]\n')
  await writeFile(watchtowerPath, '[]\n')

  try {
    const first = await applyCatalogueUpdate({ studiesPath, watchtowerPath, studies: [preaching(), family()], watchtowerStudies: [watchtower()] })
    const firstStudies = await readFile(studiesPath, 'utf8')
    const firstWatchtower = await readFile(watchtowerPath, 'utf8')
    const second = await applyCatalogueUpdate({ studiesPath, watchtowerPath, studies: [preaching(), family()], watchtowerStudies: [watchtower()] })

    assert.deepEqual(first, { changed: true })
    assert.deepEqual(second, { changed: false })
    assert.equal(await readFile(studiesPath, 'utf8'), firstStudies)
    assert.equal(await readFile(watchtowerPath, 'utf8'), firstWatchtower)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('does not publish either catalogue when candidate validation fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'family-bible-study-'))
  const studiesPath = join(directory, 'studies.json')
  const watchtowerPath = join(directory, 'watchtower-studies.json')
  await writeFile(studiesPath, '[]\n')
  await writeFile(watchtowerPath, '[]\n')

  try {
    await assert.rejects(
      applyCatalogueUpdate({ studiesPath, watchtowerPath, studies: [{ ...family(), sourceUrl: 'https://example.com' }], watchtowerStudies: [watchtower()] }),
      /Validation des catalogues échouée/,
    )
    assert.equal(await readFile(studiesPath, 'utf8'), '[]\n')
    assert.equal(await readFile(watchtowerPath, 'utf8'), '[]\n')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('treats backup cleanup failure as non-fatal after a successful transaction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'family-bible-study-cleanup-'))
  const studiesPath = join(directory, 'studies.json')
  const watchtowerPath = join(directory, 'watchtower-studies.json')
  await writeFile(studiesPath, '[]\n')
  await writeFile(watchtowerPath, '[]\n')
  let cleanupCalls = 0

  try {
    const result = await applyCatalogueUpdate({
      studiesPath,
      watchtowerPath,
      studies: [preaching(), family()],
      watchtowerStudies: [watchtower()],
      cleanupBackup: async () => {
        cleanupCalls += 1
        throw new Error('cleanup denied')
      },
    })

    assert.deepEqual(result, { changed: true })
    assert.equal(cleanupCalls, 2)
    assert.equal(JSON.parse(await readFile(studiesPath, 'utf8')).length, 2)
    assert.equal(JSON.parse(await readFile(watchtowerPath, 'utf8')).length, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
