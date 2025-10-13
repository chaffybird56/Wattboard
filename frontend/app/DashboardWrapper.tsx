'use client'

import { Suspense } from 'react'
import Dashboard from './page'

export default function DashboardWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  )
}
