import { describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  MAX_PRIVATE_PACK_BYTES,
  createIndexedDbPrivateArticleRepository,
  importWatchtowerPrivatePack,
  parseWatchtowerPrivatePack,
  type PrivateArticleRepository,
  type WatchtowerPrivatePack,
} from './watchtowerPrivateContent'

const validPack: WatchtowerPrivatePack = {
  version: 1,
  generatedAt: '2026-08-08T19:30:00.000Z',
  articles: [{
    contentKey: 'watchtower-2026401',
    documentId: 2026401,
    sourceUrl: 'https://www.jw.org/finder?wtlocale=MG&docid=2026401',
    sourceDigest: 'a'.repeat(64),
    title: 'Lahatsoratra fitsapana',
    blocks: [
      { id: 'heading-1', type: 'heading', level: 2, text: 'Intertitre' },
      { id: 'paragraph-1', type: 'paragraph', number: '1', text: 'Paragrafy voalohany.', questionIds: ['2026401-q1-2'] },
      {
        id: 'figure-1',
        type: 'figure',
        src: 'https://cms-imgp.jw-cdn.org/img/p/2026401/univ/art/2026401_univ_lsr_lg.jpg',
        alt: 'Sary fanazavana',
        caption: 'Fanazavana ny sary.',
        afterParagraph: '1',
        width: 1200,
        height: 800,
        sources: [
          { url: 'https://cms-imgp.jw-cdn.org/img/p/2026401/univ/art/2026401_univ_lsr_sm.jpg', width: 480 },
          { url: 'https://cms-imgp.jw-cdn.org/img/p/2026401/univ/art/2026401_univ_lsr_md.jpg', width: 800 },
        ],
      },
      { id: 'paragraph-2', type: 'paragraph', number: '2', text: 'Paragrafy faharoa.', questionIds: ['2026401-q1-2'] },
    ],
  }],
}

class MemoryRepository implements PrivateArticleRepository {
  articles = new Map()
  replaceAll = vi.fn(async (articles: WatchtowerPrivatePack['articles']) => {
    this.articles = new Map(articles.map((article) => [article.contentKey, article]))
  })
  get = vi.fn(async (contentKey: string) => this.articles.get(contentKey))
}

describe('watchtower private content', () => {
  it('parses a safe private pack with ordered article blocks', () => {
    const result = parseWatchtowerPrivatePack(JSON.stringify(validPack))

    expect(result).toEqual(validPack)
    expect(result.articles[0].blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'figure', 'paragraph'])
  })

  it('rejects active markup, unofficial media, duplicate ids, and malformed dimensions', () => {
    const unsafePack = structuredClone(validPack)
    unsafePack.articles[0].blocks = [
      { id: 'duplicate', type: 'paragraph', number: '1', text: '<script>alert(1)</script>', questionIds: [] },
      {
        id: 'duplicate',
        type: 'figure',
        src: 'https://example.com/image.jpg',
        sources: [
          { url: 'https://example.com/image-sm.jpg', width: 480 },
          { url: 'https://example.com/image-md.jpg', width: 800 },
        ],
        alt: '',
        caption: '',
        afterParagraph: '1',
        width: 0,
        height: -1,
      },
    ]

    expect(() => parseWatchtowerPrivatePack(JSON.stringify(unsafePack))).toThrowError(/script|officiel|duplicate|dimension/i)
  })

  it('rejects non-Malagasy sources and figures without responsive variants', () => {
    const invalidPack = structuredClone(validPack)
    invalidPack.articles[0].sourceUrl = 'https://www.jw.org/en/library/magazines/article/'
    const figure = invalidPack.articles[0].blocks[2]
    if (figure.type !== 'figure') throw new Error('Fixture figure attendue')
    figure.sources = []

    expect(() => parseWatchtowerPrivatePack(JSON.stringify(invalidPack))).toThrowError(/malagasy|sources/i)
  })

  it('replaces the local cache only after the complete file is valid', async () => {
    const repository = new MemoryRepository()
    const file = new File([JSON.stringify(validPack)], 'watchtower-private-pack.json', { type: 'application/json' })

    const imported = await importWatchtowerPrivatePack(file, repository)

    expect(imported.articleCount).toBe(1)
    expect(repository.replaceAll).toHaveBeenCalledOnce()
    expect(await repository.get('watchtower-2026401')).toEqual(validPack.articles[0])

    const invalidFile = new File(['{"version":1}'], 'invalid.json', { type: 'application/json' })
    await expect(importWatchtowerPrivatePack(invalidFile, repository)).rejects.toThrow(/articles/i)
    expect(repository.replaceAll).toHaveBeenCalledOnce()
  })

  it('rejects oversized private files before parsing them', async () => {
    const repository = new MemoryRepository()
    const file = new File(['x'.repeat(MAX_PRIVATE_PACK_BYTES + 1)], 'too-large.json', { type: 'application/json' })

    await expect(importWatchtowerPrivatePack(file, repository)).rejects.toThrow(/volumineux|size/i)
    expect(repository.replaceAll).not.toHaveBeenCalled()
  })

  it('runs catalogue compatibility checks before replacing the local cache', async () => {
    const repository = new MemoryRepository()
    const file = new File([JSON.stringify(validPack)], 'watchtower-private-pack.json', { type: 'application/json' })

    await expect(importWatchtowerPrivatePack(file, repository, () => {
      throw new Error('Article incompatible avec le catalogue public.')
    })).rejects.toThrow(/incompatible/i)

    expect(repository.replaceAll).not.toHaveBeenCalled()
  })

  it('replaces and reads the private article cache through IndexedDB', async () => {
    const repository = createIndexedDbPrivateArticleRepository(new IDBFactory())

    await repository.replaceAll(validPack.articles)
    expect(await repository.get('watchtower-2026401')).toEqual(validPack.articles[0])

    await repository.replaceAll([])
    expect(await repository.get('watchtower-2026401')).toBeUndefined()
  })
})
