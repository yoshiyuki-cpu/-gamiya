/** 出勤の前に、2人1組でお互いに確認する項目。 */
export const HYGIENE_ITEMS = [
  { id: 'hair', label: '頭髪', hint: '整っている・まとめてある' },
  { id: 'nails', label: '爪', hint: '短く切ってあり、清潔' },
  { id: 'wash', label: '手洗い・うがい', hint: '手洗いとうがいをした' },
] as const

export type HygieneItemId = (typeof HYGIENE_ITEMS)[number]['id']

/** 相手に選べる名前。自分は選べない。 */
export function partnerChoices(staffList: string[], self: string): string[] {
  return staffList.filter((n) => n !== self)
}
