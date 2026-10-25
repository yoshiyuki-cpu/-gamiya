/** 時間帯ごとの「何組が来たか・うち常連さんは何組か」の集計。 */

export type StatRow = { reservation_time: string | null; is_regular?: boolean | null }

export type Band = { id: string; label: string; fromMin: number; toMin: number }

/** 特に知りたい2つの時間帯。時刻は26時制(25:00 = 翌1:00)。from以上 to未満。 */
export const BANDS: Band[] = [
  { id: 'early', label: '17:00〜18:00', fromMin: 17 * 60, toMin: 18 * 60 },
  { id: 'late', label: '22:00〜25:00', fromMin: 22 * 60, toMin: 25 * 60 },
]

/**
 * 「17:30」「25:30」「01:00」のような時刻を、26時制の分にする。
 * 営業日は昼12時に切り替わるので、0〜11時は深夜(24〜35時)として数える。
 * 読めない・空のときは null。
 */
export function minutesOf(time: string | null | undefined): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return null
  if (h < 12) h += 24
  return h * 60 + min
}

export type Tally = { groups: number; regular: number }

function emptyTally(): Tally {
  return { groups: 0, regular: 0 }
}

export type GuestStats = {
  total: Tally
  bands: { band: Band; tally: Tally }[]
  /** 上の2つ以外の時間帯。 */
  other: Tally
  /** 予約時間が入っていない組。 */
  noTime: Tally
}

export function summarizeGuests(rows: StatRow[]): GuestStats {
  const total = emptyTally()
  const other = emptyTally()
  const noTime = emptyTally()
  const bands = BANDS.map((band) => ({ band, tally: emptyTally() }))

  for (const r of rows) {
    const regular = r.is_regular ? 1 : 0
    total.groups += 1
    total.regular += regular

    const min = minutesOf(r.reservation_time)
    if (min == null) {
      noTime.groups += 1
      noTime.regular += regular
      continue
    }
    const hit = bands.find(({ band }) => min >= band.fromMin && min < band.toMin)
    const target = hit ? hit.tally : other
    target.groups += 1
    target.regular += regular
  }
  return { total, bands, other, noTime }
}

/** 0〜100の整数。分母が0なら null。 */
export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}
