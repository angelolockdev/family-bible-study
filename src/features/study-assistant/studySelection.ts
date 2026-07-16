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

export function selectFamilyStudy(items: Study[], date: Date): StudySelection {
  const familyStudies = items.filter((study) => study.kind === 'family')
  const today = toDateOnly(date)
  const current = familyStudies.find((study) => study.startDate <= today && today <= study.endDate)

  if (current) return { study: current, reason: 'current' }

  const upcoming = [...familyStudies]
    .filter((study) => study.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  if (upcoming) return { study: upcoming, reason: 'upcoming' }

  const archiveFallback = [...familyStudies].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  return { study: archiveFallback, reason: 'archive-fallback' }
}
