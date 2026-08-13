export type Study = {
  id: string
  kind: string
  startDate: string
  endDate: string
}

export type StudySelectionReason = 'current' | 'upcoming' | 'archive-fallback'

export type StudySelection = {
  study: Study | undefined
  reason: StudySelectionReason
}

function toDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getStudySelectionReason(study: Pick<Study, 'startDate' | 'endDate'>, date: Date): StudySelectionReason {
  const today = toDateOnly(date)
  if (study.startDate <= today && today <= study.endDate) return 'current'
  return study.startDate > today ? 'upcoming' : 'archive-fallback'
}

export function selectStudy(items: Study[], kind: string, date: Date): StudySelection {
  const matchingStudies = items.filter((study) => study.kind === kind)
  const today = toDateOnly(date)
  const current = matchingStudies.find((study) => getStudySelectionReason(study, date) === 'current')

  if (current) return { study: current, reason: 'current' }

  const upcoming = [...matchingStudies]
    .filter((study) => study.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  if (upcoming) return { study: upcoming, reason: 'upcoming' }

  const archiveFallback = [...matchingStudies].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  return { study: archiveFallback, reason: 'archive-fallback' }
}

export function selectFamilyStudy(items: Study[], date: Date): StudySelection {
  return selectStudy(items, 'family', date)
}
