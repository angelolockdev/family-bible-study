export type ArchiveDated = {
  startDate: string
  endDate: string
}

function localDate(date: string) {
  return new Date(`${date}T12:00:00`)
}

export function visibleArchiveItems<T extends ArchiveDated>(items: readonly T[], today: Date, months = 2) {
  const cutoff = new Date(today.getFullYear(), today.getMonth() - months, today.getDate(), 12)

  return [...items]
    .filter((item) => localDate(item.endDate) >= cutoff)
    .sort((first, second) => second.startDate.localeCompare(first.startDate))
}
