export function verseIdsFromUrl(url: string): string[]
export function extractVerseExcerptFromHtml(html: string, verseIds: string[]): string
export function hydrateVerseExcerpts<T>(studies: T): Promise<T>
