export type RefillEntry = { staff_name: string; drink_refills: number | null }
export type RefillTally = { name: string; count: number }

/** 退勤のときに入れた杯数を、人ごとに足す。入れていない勤務(null)は数えない。多い順。 */
export function tallyRefills(entries: RefillEntry[]): { total: number; byStaff: RefillTally[] } {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (e.drink_refills == null) continue
    map.set(e.staff_name, (map.get(e.staff_name) ?? 0) + e.drink_refills)
  }
  const byStaff = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
  return { total: byStaff.reduce((sum, s) => sum + s.count, 0), byStaff }
}

/** 「ドリンクおかわりの声掛け」のような項目か。名前の細かい違いに強くするため、おかわり/お代わりだけ見る。 */
export function isRefillItemText(text: string): boolean {
  return /おかわり|お代わり|おかわ/.test(text)
}
