export const MAX_PRIVATE_PACK_BYTES = 5 * 1024 * 1024

const DATABASE_NAME = 'family-bible-study-private-content'
const DATABASE_VERSION = 1
const ARTICLE_STORE = 'watchtower-articles'

export type WatchtowerPrivateHeading = {
  id: string
  type: 'heading'
  level: 2 | 3
  text: string
}

export type WatchtowerPrivateParagraph = {
  id: string
  type: 'paragraph'
  number: string
  text: string
  questionIds: string[]
  segments?: WatchtowerPrivateParagraphSegment[]
}

export type WatchtowerPrivateParagraphSegment =
  | { type: 'text'; text: string }
  | { type: 'scripture'; label: string; url: string; excerpt: string }

export type WatchtowerPrivateFigureSource = {
  url: string
  width: number
}

export type WatchtowerPrivateFigure = {
  id: string
  type: 'figure'
  src: string
  sources: WatchtowerPrivateFigureSource[]
  alt: string
  caption: string
  afterParagraph: string
  width: number
  height: number
}

export type WatchtowerPrivateSummary = {
  id: string
  type: 'summary'
  title: string
  prompts: string[]
}

export type WatchtowerPrivateBlock = WatchtowerPrivateHeading | WatchtowerPrivateParagraph | WatchtowerPrivateFigure | WatchtowerPrivateSummary

export type WatchtowerPrivateArticle = {
  contentKey: string
  documentId: number
  sourceUrl: string
  sourceDigest: string
  title: string
  blocks: WatchtowerPrivateBlock[]
}

export type WatchtowerPrivatePack = {
  version: 1
  generatedAt: string
  articles: WatchtowerPrivateArticle[]
}

export type PrivateArticleRepository = {
  replaceAll: (articles: WatchtowerPrivateArticle[]) => Promise<void>
  get: (contentKey: string) => Promise<WatchtowerPrivateArticle | undefined>
}

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function hasActiveMarkup(value: string) {
  return /<\s*(script|iframe|object|embed|style|link|meta)\b/i.test(value)
}

function isOfficialSourceUrl(value: unknown) {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    const officialHost = url.hostname === 'jw.org' || url.hostname.endsWith('.jw.org')
    const malagasy = url.pathname.startsWith('/mg/') || url.searchParams.get('wtlocale')?.toUpperCase() === 'MG'
    return url.protocol === 'https:' && officialHost && malagasy
  } catch {
    return false
  }
}

function isOfficialMediaUrl(value: unknown) {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (
      url.hostname === 'jw.org'
      || url.hostname.endsWith('.jw.org')
      || url.hostname === 'jw-cdn.org'
      || url.hostname.endsWith('.jw-cdn.org')
      || url.hostname === 'assetsnffrgf-a.akamaihd.net'
    )
  } catch {
    return false
  }
}

function validateSafeText(value: unknown, path: string, errors: string[]) {
  if (!isNonEmptyString(value)) {
    errors.push(`${path} doit être un texte non vide`)
    return
  }
  if (hasActiveMarkup(value)) errors.push(`${path} contient une balise script ou active interdite`)
}

function validateBlock(block: unknown, path: string, errors: string[]) {
  if (!isRecord(block)) {
    errors.push(`${path} doit être un objet`)
    return
  }

  validateSafeText(block.id, `${path}.id`, errors)
  if (block.type === 'heading') {
    if (block.level !== 2 && block.level !== 3) errors.push(`${path}.level doit être 2 ou 3`)
    validateSafeText(block.text, `${path}.text`, errors)
    return
  }

  if (block.type === 'paragraph') {
    validateSafeText(block.number, `${path}.number`, errors)
    validateSafeText(block.text, `${path}.text`, errors)
    if (!Array.isArray(block.questionIds) || block.questionIds.some((id) => !isNonEmptyString(id))) {
      errors.push(`${path}.questionIds doit être une liste d’identifiants`)
    } else if (new Set(block.questionIds).size !== block.questionIds.length) {
      errors.push(`${path}.questionIds contient un identifiant dupliqué`)
    }
    if (block.segments !== undefined) {
      if (!Array.isArray(block.segments) || block.segments.length === 0) {
        errors.push(`${path}.segments doit être une liste non vide`)
      } else {
        block.segments.forEach((segment, segmentIndex) => {
          const segmentPath = `${path}.segments[${segmentIndex}]`
          if (!isRecord(segment)) {
            errors.push(`${segmentPath} doit être un objet`)
          } else if (segment.type === 'text') {
            validateSafeText(segment.text, `${segmentPath}.text`, errors)
          } else if (segment.type === 'scripture') {
            validateSafeText(segment.label, `${segmentPath}.label`, errors)
            validateSafeText(segment.excerpt, `${segmentPath}.excerpt`, errors)
            if (!isOfficialSourceUrl(segment.url)) errors.push(`${segmentPath}.url doit pointer vers une source JW officielle en malagasy`)
          } else {
            errors.push(`${segmentPath}.type est inconnu`)
          }
        })
      }
    }
    return
  }

  if (block.type === 'summary') {
    validateSafeText(block.title, `${path}.title`, errors)
    if (!Array.isArray(block.prompts) || block.prompts.length === 0) {
      errors.push(`${path}.prompts doit contenir au moins une question de synthèse`)
    } else {
      block.prompts.forEach((prompt, promptIndex) => validateSafeText(prompt, `${path}.prompts[${promptIndex}]`, errors))
    }
    return
  }

  if (block.type === 'figure') {
    if (!isOfficialMediaUrl(block.src)) errors.push(`${path}.src doit utiliser un domaine média officiel JW`)
    validateSafeText(block.alt, `${path}.alt`, errors)
    validateSafeText(block.caption, `${path}.caption`, errors)
    validateSafeText(block.afterParagraph, `${path}.afterParagraph`, errors)
    if (!isPositiveInteger(block.width) || !isPositiveInteger(block.height)) errors.push(`${path} possède des dimensions invalides`)
    if (!Array.isArray(block.sources) || block.sources.length < 2) {
      errors.push(`${path}.sources doit contenir au moins deux variantes responsives`)
    } else {
      const sourceWidths = new Set<number>()
      block.sources.forEach((source, sourceIndex) => {
        const sourcePath = `${path}.sources[${sourceIndex}]`
        if (!isRecord(source) || !isOfficialMediaUrl(source.url) || !isPositiveInteger(source.width)) {
          errors.push(`${sourcePath} doit contenir une URL officielle et une largeur valide`)
          return
        }
        if (sourceWidths.has(source.width)) errors.push(`${sourcePath}.width est dupliquée`)
        sourceWidths.add(source.width)
      })
    }
    return
  }

  errors.push(`${path}.type est inconnu`)
}

function validateArticle(article: unknown, path: string, errors: string[]) {
  if (!isRecord(article)) {
    errors.push(`${path} doit être un objet`)
    return
  }

  validateSafeText(article.contentKey, `${path}.contentKey`, errors)
  if (!isPositiveInteger(article.documentId)) errors.push(`${path}.documentId doit être un entier positif`)
  if (!isOfficialSourceUrl(article.sourceUrl)) errors.push(`${path}.sourceUrl doit pointer vers jw.org`)
  if (!isNonEmptyString(article.sourceDigest) || !/^[a-f0-9]{64}$/i.test(article.sourceDigest)) {
    errors.push(`${path}.sourceDigest doit être un SHA-256 hexadécimal`)
  }
  validateSafeText(article.title, `${path}.title`, errors)

  if (!Array.isArray(article.blocks) || article.blocks.length === 0) {
    errors.push(`${path}.blocks doit contenir au moins un bloc`)
    return
  }

  article.blocks.forEach((block, index) => validateBlock(block, `${path}.blocks[${index}]`, errors))

  const blockIds = new Set<string>()
  const paragraphNumbers = new Set<string>()
  article.blocks.forEach((block, index) => {
    if (!isRecord(block)) return
    if (isNonEmptyString(block.id)) {
      if (blockIds.has(block.id)) errors.push(`${path}.blocks[${index}].id est dupliqué`)
      blockIds.add(block.id)
    }
    if (block.type === 'paragraph' && isNonEmptyString(block.number)) {
      if (paragraphNumbers.has(block.number)) errors.push(`${path}.blocks[${index}].number est dupliqué`)
      paragraphNumbers.add(block.number)
    }
  })
  article.blocks.forEach((block, index) => {
    if (isRecord(block) && block.type === 'figure' && isNonEmptyString(block.afterParagraph) && !paragraphNumbers.has(block.afterParagraph)) {
      errors.push(`${path}.blocks[${index}].afterParagraph ne correspond à aucun paragraphe`)
    }
  })
}

export function parseWatchtowerPrivatePack(serialized: string): WatchtowerPrivatePack {
  let candidate: unknown
  try {
    candidate = JSON.parse(serialized)
  } catch {
    throw new Error('Le pack privé n’est pas un fichier JSON valide.')
  }

  const errors: string[] = []
  if (!isRecord(candidate)) {
    throw new Error('Le pack privé doit être un objet JSON.')
  }
  if (candidate.version !== 1) errors.push('version doit être égale à 1')
  if (!isNonEmptyString(candidate.generatedAt) || Number.isNaN(Date.parse(candidate.generatedAt))) {
    errors.push('generatedAt doit être une date ISO valide')
  }
  if (!Array.isArray(candidate.articles) || candidate.articles.length === 0) {
    errors.push('articles doit contenir au moins un article')
  } else {
    candidate.articles.forEach((article, index) => validateArticle(article, `articles[${index}]`, errors))
    const keys = new Set<string>()
    candidate.articles.forEach((article, index) => {
      if (!isRecord(article) || !isNonEmptyString(article.contentKey)) return
      if (keys.has(article.contentKey)) errors.push(`articles[${index}].contentKey est dupliqué`)
      keys.add(article.contentKey)
    })
  }

  if (errors.length > 0) throw new Error(`Pack privé invalide : ${errors.join(' ; ')}`)
  return candidate as WatchtowerPrivatePack
}

function readFileText(file: File) {
  if (typeof file.text === 'function') return file.text()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Impossible de lire le pack privé.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

export async function importWatchtowerPrivatePack(
  file: File,
  repository: PrivateArticleRepository,
  assertCompatible: (pack: WatchtowerPrivatePack) => void = () => undefined,
) {
  if (file.size > MAX_PRIVATE_PACK_BYTES) {
    throw new Error('Le pack privé est trop volumineux (taille maximale : 5 Mo).')
  }
  const pack = parseWatchtowerPrivatePack(await readFileText(file))
  assertCompatible(pack)
  await repository.replaceAll(pack.articles)
  return { articleCount: pack.articles.length, generatedAt: pack.generatedAt }
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Échec IndexedDB.'))
  })
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB annulée.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Transaction IndexedDB échouée.'))
  })
}

async function openPrivateContentDatabase(factory: IDBFactory) {
  const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(ARTICLE_STORE)) database.createObjectStore(ARTICLE_STORE, { keyPath: 'contentKey' })
  }
  return requestResult(request)
}

export function createIndexedDbPrivateArticleRepository(factory: IDBFactory = indexedDB): PrivateArticleRepository {
  return {
    async replaceAll(articles) {
      const database = await openPrivateContentDatabase(factory)
      try {
        const transaction = database.transaction(ARTICLE_STORE, 'readwrite')
        const store = transaction.objectStore(ARTICLE_STORE)
        store.clear()
        articles.forEach((article) => store.put(article))
        await transactionComplete(transaction)
      } finally {
        database.close()
      }
    },
    async get(contentKey) {
      const database = await openPrivateContentDatabase(factory)
      try {
        const transaction = database.transaction(ARTICLE_STORE, 'readonly')
        const result = await requestResult(transaction.objectStore(ARTICLE_STORE).get(contentKey))
        await transactionComplete(transaction)
        return result as WatchtowerPrivateArticle | undefined
      } finally {
        database.close()
      }
    },
  }
}
