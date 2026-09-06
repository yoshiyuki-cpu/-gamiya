export type MeetingCategoryId = 'morning' | 'mtg' | 'daily'

// 「良かった事・悪かった事」は議事録ではなく「ふりかえり」(日報の画面から1行で書く)に移した。
// 議事録で新しく作れるのは朝礼と会議だけ。
export const MEETING_CATEGORIES: { id: MeetingCategoryId; badge: string; name: string; sub: string }[] = [
  { id: 'morning', badge: '朝', name: '朝礼', sub: '朝のミーティング記録' },
  { id: 'mtg', badge: '会', name: '会議', sub: '打ち合わせ・ミーティング記録' },
]

/** 昔の記録(daily)にも名前を出せるよう、消した種別もここに残す。 */
export const MEETING_CATEGORY_LABEL: Record<string, string> = {
  morning: '朝礼',
  mtg: '会議',
  daily: '良かった事・悪かった事(議事録)',
}
