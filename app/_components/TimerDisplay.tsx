'use client'

import { useEffect, useState } from 'react'
import { formatDuration, timerElapsedMs } from '@/lib/checklist'

export default function TimerDisplay({
  accumulatedMs,
  startedAt,
}: {
  accumulatedMs: number
  startedAt: string | null
}) {
  // `tick` only exists to force a re-render every second while running —
  // the displayed value itself is always recomputed fresh below, in render.
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  void tick
  const display = formatDuration(timerElapsedMs(accumulatedMs, startedAt))

  return <span className="timer-display">{display}</span>
}
