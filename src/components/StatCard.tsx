import type { ReactNode } from 'react'

type StatCardProps = {
  title: string
  value: number
  hint: string
  icon: ReactNode
  accent?: boolean
}

export default function StatCard({
  title,
  value,
  hint,
  icon,
  accent = false,
}: StatCardProps) {
  return (
    <div className={`stat-card ${accent ? 'stat-accent' : ''}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  )
}
