export function formatDate(date?: string | null): string {
  if (!date) return '—'

  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
