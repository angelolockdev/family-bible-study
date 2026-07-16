import { describe, expect, it } from 'vitest'
import { selectFamilyStudy, type Study } from './studySelection'

const familyStudy = (id: string, startDate: string, endDate: string): Study => ({
  id,
  kind: 'family',
  startDate,
  endDate,
})

const preachingStudy: Study = {
  id: 'preaching-2026-07-20',
  kind: 'preaching',
  startDate: '2026-07-20',
  endDate: '2026-07-26',
}

const studies: Study[] = [
  familyStudy('family-2026-07-27', '2026-07-27', '2026-08-02'),
  preachingStudy,
  familyStudy('family-2026-07-13', '2026-07-13', '2026-07-19'),
]

describe('selectFamilyStudy', () => {
  it('selects the family study covering the supplied date as current', () => {
    const result = selectFamilyStudy(studies, new Date(2026, 6, 15, 23, 30))

    expect(result).toEqual({ study: studies[2], reason: 'current' })
  })

  it('selects the first future family study by start date as upcoming', () => {
    const result = selectFamilyStudy(studies, new Date(2026, 6, 26))

    expect(result).toEqual({ study: studies[0], reason: 'upcoming' })
  })

  it('uses the latest family study as an archive fallback when none is current or future', () => {
    const result = selectFamilyStudy(studies, new Date(2026, 8, 1))

    expect(result).toEqual({ study: studies[0], reason: 'archive-fallback' })
  })

  it('does not treat a study whose end date has passed as current', () => {
    const result = selectFamilyStudy(
      [familyStudy('past', '2026-07-13', '2026-07-19'), familyStudy('future', '2026-07-27', '2026-08-02')],
      new Date(2026, 6, 20),
    )

    expect(result).toEqual({
      study: expect.objectContaining({ id: 'future' }),
      reason: 'upcoming',
    })
  })

  it('compares date-only values without timezone drift and preserves input order', () => {
    const input = [
      familyStudy('future', '2026-07-21', '2026-07-27'),
      familyStudy('current', '2026-07-20', '2026-07-20'),
    ]
    const original = [...input]

    const result = selectFamilyStudy(input, new Date(2026, 6, 20, 23, 59, 59))

    expect(result).toEqual({ study: input[1], reason: 'current' })
    expect(input).toEqual(original)
  })

  it('returns no study when there are no family studies', () => {
    expect(selectFamilyStudy([preachingStudy], new Date(2026, 6, 20))).toEqual({
      study: undefined,
      reason: 'archive-fallback',
    })
  })
})
