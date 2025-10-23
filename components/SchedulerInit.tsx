'use client'

import { useEffect } from 'react'

/**
 * Client component that triggers scheduler initialization on mount
 * This ensures the cron job is set up when the app starts
 */
export default function SchedulerInit() {
  useEffect(() => {
    // Only run once on mount
    fetch('/api/scheduler/init')
      .then(res => res.json())
      .then(data => {
        if (data.enabled) {
          console.log('[Client] Scheduler initialized')
        }
      })
      .catch(err => {
        console.error('[Client] Failed to initialize scheduler:', err)
      })
  }, [])

  return null
}

