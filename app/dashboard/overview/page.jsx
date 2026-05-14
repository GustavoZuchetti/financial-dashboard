'use client'
import dynamic from 'next/dynamic'

// ssr: false — evita hydration mismatch causado por new Date() no servidor
const OverviewContent = dynamic(
  () => import('./OverviewContent'),
  { ssr: false, loading: () => null }
)

export default function OverviewPage() {
  return <OverviewContent />
}
