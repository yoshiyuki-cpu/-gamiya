export type MeetingCategoryId = 'morning' | 'mtg' | 'daily'

export const MEETING_CATEGORIES: { id: MeetingCategoryId; badge: string; name: string; sub: string }[] = [
  { id: 'morning', badge: '朝', name: '朝礼', sub: '朝のミーティング記録' },
  { id: 'mtg', badge: '会', name: '会議', sub: '打ち合わせ・ミーティング記録' },
  { id: 'daily', badge: '日', name: '日報', sub: '今日の良かったこと・悪かったこと' },
]
