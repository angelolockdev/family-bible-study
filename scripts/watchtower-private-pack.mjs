import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { extractVerseExcerptFromHtml, verseIdsFromUrl } from './extract-jw-verses.mjs'

const RESPONSIVE_WIDTHS = { xs: 320, sm: 480, md: 800, lg: 1200 }

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function officialPageUrl(value) {
  const url = new URL(value)
  const officialHost = url.hostname === 'jw.org' || url.hostname.endsWith('.jw.org')
  const malagasy = url.pathname.startsWith('/mg/') || url.searchParams.get('wtlocale')?.toUpperCase() === 'MG'
  if (url.protocol !== 'https:' || !officialHost || !malagasy) {
    throw new Error(`Source Watchtower non officielle ou non malagasy : ${value}`)
  }
  return url
}

function officialMediaUrl(value) {
  const url = new URL(value)
  const official = url.hostname === 'jw-cdn.org'
    || url.hostname.endsWith('.jw-cdn.org')
    || url.hostname === 'assetsnffrgf-a.akamaihd.net'
  if (url.protocol !== 'https:' || !official) throw new Error(`Média Watchtower non officiel : ${value}`)
  return url.toString()
}

function questionIdsByParagraph(study) {
  const ids = new Map()
  for (const question of study.questions ?? []) {
    for (const number of question.paragraphNumbers ?? []) {
      const key = String(number)
      ids.set(key, [...(ids.get(key) ?? []), question.id])
    }
  }
  return ids
}

async function paragraphData(element, sourceUrl, excerptForUrl) {
  const clone = element.cloneNode(true)
  const paragraphNumberNode = clone.querySelector('.parNum[data-pnum]')
  const explicitNumber = paragraphNumberNode?.getAttribute('data-pnum')
  paragraphNumberNode?.remove()
  clone.querySelectorAll('.footnoteLink').forEach((link) => link.remove())
  let text = normalizeText(clone.textContent)
  const prefixedNumber = text.match(/^(\d+)\s+(.+)$/s)
  const number = explicitNumber || prefixedNumber?.[1] || `fanampiny-${element.dataset.pid || element.id || 'sans-id'}`
  if (!explicitNumber && prefixedNumber) text = prefixedNumber[2]

  if (!excerptForUrl || !clone.querySelector('a.jsBibleLink')) return { number, text }

  const segments = []
  const appendText = (value) => {
    const normalized = String(value ?? '').replace(/\s+/g, ' ')
    if (!normalized) return
    const previous = segments.at(-1)
    if (previous?.type === 'text') previous.text += normalized
    else segments.push({ type: 'text', text: normalized })
  }
  const walk = (node) => {
    if (node.nodeType === 3) {
      appendText(node.textContent)
      return
    }
    if (node.nodeType !== 1) return
    if (node.matches('a.jsBibleLink')) {
      const url = officialPageUrl(new URL(node.getAttribute('href'), sourceUrl).toString()).toString()
      segments.push({ type: 'scripture', label: normalizeText(node.textContent), url })
      return
    }
    node.childNodes.forEach(walk)
  }
  clone.childNodes.forEach(walk)

  const firstText = segments.find((segment) => segment.type === 'text')
  if (firstText) {
    firstText.text = explicitNumber
      ? firstText.text.trimStart()
      : firstText.text.replace(/^\s*\d+\s+/, '')
  }
  const lastText = segments.findLast((segment) => segment.type === 'text')
  if (lastText) lastText.text = lastText.text.trimEnd()

  for (const segment of segments) {
    if (segment.type === 'scripture') segment.excerpt = await excerptForUrl(segment.url)
  }
  return { number, text, segments: segments.filter((segment) => segment.type !== 'text' || segment.text) }
}

function figureData(element, latestParagraphNumber) {
  if (!latestParagraphNumber) throw new Error('Une image Watchtower apparaît avant tout paragraphe identifiable.')
  const responsive = element.querySelector('.jsRespImg')
  const fallback = element.querySelector('img')
  const entries = Object.entries(RESPONSIVE_WIDTHS)
    .map(([size, width]) => ({ url: responsive?.getAttribute(`data-img-size-${size}`), width }))
    .filter((source) => source.url)
    .map((source) => ({ url: officialMediaUrl(source.url), width: source.width }))
  const src = entries.find((source) => source.width === RESPONSIVE_WIDTHS.lg)?.url
    || entries.at(-1)?.url
    || officialMediaUrl(fallback?.getAttribute('src'))
  const alt = normalizeText(responsive?.getAttribute('data-img-att-alt') || fallback?.getAttribute('alt'))
  const caption = normalizeText(element.querySelector('figcaption')?.textContent) || alt
  return { src, sources: entries, alt, caption, afterParagraph: latestParagraphNumber }
}

export async function extractPrivateArticle({ html, study, dimensionsForUrl, excerptForUrl }) {
  officialPageUrl(study.sourceUrl)
  const sourceDigest = createHash('sha256').update(html).digest('hex')
  if (study.sourceDigest && sourceDigest.toLowerCase() !== study.sourceDigest.toLowerCase()) {
    throw new Error(`La source Watchtower a changé depuis la publication du catalogue : ${study.id}`)
  }
  const document = new JSDOM(html).window.document
  const root = document.querySelector('#article .bodyTxt') || document.querySelector('#article')
  if (!root) throw new Error(`Article Watchtower introuvable pour ${study.id}.`)
  const publicQuestions = questionIdsByParagraph(study)
  const blocks = []
  const blockIds = new Set()
  let latestParagraphNumber
  let fallbackId = 0

  const uniqueId = (prefix, preferred) => {
    let id = `${prefix}-${preferred || ++fallbackId}`
    while (blockIds.has(id)) id = `${prefix}-${preferred || fallbackId}-${++fallbackId}`
    blockIds.add(id)
    return id
  }

  for (const element of root.querySelectorAll('h2,h3,p,figure')) {
    if (element.closest('figure') && element.tagName !== 'FIGURE') continue

    if (element.tagName === 'H2' || element.tagName === 'H3') {
      const text = normalizeText(element.textContent)
      if (!text) continue
      blocks.push({
        id: uniqueId('heading', element.dataset.pid),
        type: 'heading',
        level: element.tagName === 'H2' ? 2 : 3,
        text,
      })
      continue
    }

    if (element.tagName === 'FIGURE') {
      const data = figureData(element, latestParagraphNumber)
      const dimensions = await dimensionsForUrl(data.src)
      blocks.push({ id: uniqueId('figure', element.dataset.pid), type: 'figure', ...data, ...dimensions })
      continue
    }

    if (!/^p\d+$/.test(element.className)) continue
    const { number, text, segments } = await paragraphData(element, study.sourceUrl, excerptForUrl)
    if (!text) continue
    latestParagraphNumber = number
    blocks.push({
      id: uniqueId('paragraph', element.dataset.pid),
      type: 'paragraph',
      number,
      text,
      questionIds: publicQuestions.get(number) ?? [],
      ...(segments ? { segments } : {}),
    })
  }

  const summary = document.querySelector('#article aside')
  const summaryTitle = normalizeText(summary?.querySelector('.boxTtl h2, .boxTtl')?.textContent)
  const summaryPrompts = [...(summary?.querySelectorAll('.boxContent li > p') ?? [])]
    .map((element) => normalizeText(element.textContent))
    .filter(Boolean)
  if (summaryTitle && summaryPrompts.length > 0) {
    blocks.push({
      id: uniqueId('summary', summary?.dataset.pid || 'review'),
      type: 'summary',
      title: summaryTitle,
      prompts: summaryPrompts,
    })
  }

  if (blocks.filter((block) => block.type === 'paragraph').length === 0) {
    throw new Error(`Aucun paragraphe Watchtower extrait pour ${study.id}.`)
  }

  return {
    contentKey: study.id,
    documentId: study.documentId,
    sourceUrl: study.sourceUrl,
    sourceDigest,
    title: normalizeText(document.querySelector('#article h1')?.textContent) || study.title,
    blocks,
  }
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('Le média JW téléchargé n’est pas un JPEG valide.')
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    if (length < 2) break
    offset += 2 + length
  }
  throw new Error('Dimensions JPEG introuvables.')
}

async function fetchText(url) {
  officialPageUrl(url)
  const response = await fetch(url, { headers: { 'accept-language': 'mg', 'user-agent': 'family-bible-study-private-pack/1.0' } })
  if (!response.ok) throw new Error(`Téléchargement Watchtower échoué (${response.status}) : ${url}`)
  return response.text()
}

async function fetchDimensions(url) {
  officialMediaUrl(url)
  const response = await fetch(url, { headers: { 'user-agent': 'family-bible-study-private-pack/1.0' } })
  if (!response.ok) throw new Error(`Téléchargement du média échoué (${response.status}) : ${url}`)
  return jpegDimensions(Buffer.from(await response.arrayBuffer()))
}

function createVerseExcerptFetcher() {
  const chapterCache = new Map()
  return async (url) => {
    const chapterUrl = new URL(url)
    chapterUrl.hash = ''
    const key = chapterUrl.toString()
    const html = chapterCache.get(key) ?? await fetchText(key)
    chapterCache.set(key, html)
    return extractVerseExcerptFromHtml(html, verseIdsFromUrl(url))
  }
}

function parseArguments(argv) {
  const result = { output: '.private/watchtower-private-pack.json', studyId: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') result.output = argv[++index]
    else if (argv[index] === '--study') result.studyId = argv[++index]
    else throw new Error(`Argument inconnu : ${argv[index]}`)
  }
  return result
}

export async function buildPrivatePack({ studies, fetchArticle = fetchText, dimensionsForUrl = fetchDimensions, excerptForUrl }) {
  const articles = []
  const resolveExcerpt = excerptForUrl ?? createVerseExcerptFetcher()
  for (const study of studies) {
    const html = await fetchArticle(study.sourceUrl)
    articles.push(await extractPrivateArticle({ html, study, dimensionsForUrl, excerptForUrl: resolveExcerpt }))
  }
  return { version: 1, generatedAt: new Date().toISOString(), articles }
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2))
  const studies = JSON.parse(await readFile(resolve('src/data/watchtower-studies.json'), 'utf8'))
  const selectedStudies = options.studyId ? studies.filter((study) => study.id === options.studyId) : studies
  if (selectedStudies.length === 0) throw new Error(`Étude Watchtower introuvable : ${options.studyId}`)
  const pack = await buildPrivatePack({ studies: selectedStudies })
  const output = resolve(options.output)
  const temporary = `${output}.tmp-${process.pid}`
  await mkdir(dirname(output), { recursive: true })
  try {
    await writeFile(temporary, `${JSON.stringify(pack, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, output)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
  console.log(`Pack Watchtower privé créé : ${output} (${pack.articles.length} article(s)).`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
