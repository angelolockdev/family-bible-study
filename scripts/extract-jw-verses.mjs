import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function decodeHtml(value) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function verseIdsFromUrl(url) {
  const hash = new URL(url).hash
  const match = hash.match(/^#(v\d+)(?:-(v\d+))?$/)
  if (!match) throw new Error(`Ancre de verset JW invalide : ${url}`)

  const [, first, last = first] = match
  const firstNumber = Number(first.slice(1))
  const lastNumber = Number(last.slice(1))
  if (!Number.isSafeInteger(firstNumber) || !Number.isSafeInteger(lastNumber) || lastNumber < firstNumber) {
    throw new Error(`Plage de versets JW invalide : ${url}`)
  }

  return Array.from({ length: lastNumber - firstNumber + 1 }, (_, index) => `v${firstNumber + index}`)
}

function visibleVerseText(html, verseId) {
  const marker = `<span class="verse" id="${verseId}">`
  const start = html.indexOf(marker)
  if (start === -1) throw new Error(`Verse introuvable dans la source JW : ${verseId}`)

  const next = html.indexOf('<span class="verse" id="', start + marker.length)
  const fragment = html.slice(start, next === -1 ? html.length : next)

  return decodeHtml(
    fragment
      .replace(/<a\b[^>]*class="[^"]*(?:footnoteLink|xrefLink)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function extractVerseExcerptFromHtml(html, verseIds) {
  if (!Array.isArray(verseIds) || verseIds.length === 0) throw new Error('Aucun verset à extraire')
  return verseIds.map((verseId) => visibleVerseText(html, verseId)).join(' ')
}

function documentUrl(url) {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.toString()
}

async function fetchOfficialChapter(url) {
  const response = await fetch(url, {
    headers: {
      'accept-language': 'mg,fr;q=0.8,en;q=0.6',
      'user-agent': 'family-bible-study verse catalogue generator/1.0',
    },
  })
  if (!response.ok) throw new Error(`Source JW indisponible (${response.status}) : ${url}`)
  return response.text()
}

export async function hydrateVerseExcerpts(studies) {
  const chapterCache = new Map()

  for (const study of studies) {
    for (const question of study.questions ?? []) {
      for (const reference of question.references ?? []) {
        const url = documentUrl(reference.url)
        const html = chapterCache.get(url) ?? await fetchOfficialChapter(url)
        chapterCache.set(url, html)
        reference.excerpt = extractVerseExcerptFromHtml(html, verseIdsFromUrl(reference.url))
      }
    }
  }

  return studies
}

async function main() {
  const filePath = resolve(process.argv[2] ?? 'src/data/watchtower-studies.json')
  const studies = JSON.parse(await readFile(filePath, 'utf8'))
  if (!Array.isArray(studies)) throw new Error('Le catalogue Watchtower doit être un tableau JSON.')

  await hydrateVerseExcerpts(studies)
  await writeFile(filePath, `${JSON.stringify(studies, null, 2)}\n`, 'utf8')
  console.log(`Extraits JW officiels ajoutés : ${studies.length} étude(s).`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
