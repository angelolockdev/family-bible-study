import { describe, expect, it } from 'vitest'
import { visibleArchiveItems } from './archiveWindow'

describe('visibleArchiveItems', () => {
  it('keeps the calendar two-month window, sorts newest first, and does not mutate input', () => {
    const items = [
      { id: 'boundary', startDate: '2026-06-08', endDate: '2026-06-08' },
      { id: 'old', startDate: '2026-06-07', endDate: '2026-06-07' },
      { id: 'current', startDate: '2026-08-03', endDate: '2026-08-09' },
    ]
    const originalOrder = items.map((item) => item.id)

    expect(visibleArchiveItems(items, new Date(2026, 7, 8)).map((item) => item.id)).toEqual(['current', 'boundary'])
    expect(items.map((item) => item.id)).toEqual(originalOrder)
  })
})
