import { createClient } from '@supabase/supabase-js'

// Fall back to harmless placeholders so module evaluation never throws during
// Next.js's build-time page-data collection (which runs even for
// force-dynamic routes). The real values are still used whenever the env
// vars are actually set — this only guards against a missing/misconfigured
// env var crashing the whole build instead of failing loudly in the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Category = {
  id: string
  badge: string
  name: string
  sub: string
  sort_order: number
}

export type Item = {
  id: number
  category_id: string
  text: string
  has_quantity: boolean
  sort_order: number
  deadline_id: number | null
  updated_at: string
  created_at: string
}

export type Deadline = {
  id: number
  label: string
  sort_order: number
  created_at: string
}

export type DailyRecord = {
  id: number
  item_id: number
  record_date: string
  checked: boolean
  quantity_value: string | null
  checked_time: string | null
  staff_name: string | null
  timer_started_at: string | null
  timer_accumulated_ms: number
  updated_at: string
}

// 1件 = 1回の勤務。work_date は営業日(朝5時区切り)なので、
// 深夜までの勤務も出勤した日の1件としてまとまる。
export type TimeEntry = {
  id: number
  staff_name: string
  work_date: string
  clock_in: string | null
  clock_out: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type TimeBreak = {
  id: number
  entry_id: number
  break_start: string
  break_end: string | null
  created_at: string
}

export type StaffName = {
  id: number
  name: string
  created_at: string
}

export type WallMenuItem = {
  id: number
  name: string
  sort_order: number
  created_at: string
}

export type WallOrder = {
  id: number
  table_number: string
  item_name: string
  quantity: number
  staff_name: string | null
  created_at: string
  completed_at: string | null
}

// 行が存在する = その営業日にXへ投稿した、という意味。未投稿の日は行が無い。
export type XPost = {
  id: number
  post_date: string
  posted_at: string
  staff_name: string | null
  memo: string | null
  created_at: string
}

export type DailyReport = {
  id: number
  report_date: string
  summary: string
  stats: Record<string, number> | null
  created_at: string
}

export type Recipe = {
  id: number
  category: string
  name: string
  prep_time: string | null
  ingredients: string | null
  steps: string | null
  notes: string | null
  photo_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type GuestCheckItem = {
  id: number
  text: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type GuestCheckSession = {
  id: number
  table_number: string
  item_id: number
  checked_at: string
}

export type SatisfactionRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'E'

// 1組(1グループ)のお客様の記録。予約名・予約時間で先に登録しておき、
// 帰り際に rank(S〜E)とお客様の声を書き足す台帳として使う。
export type GuestSatisfactionRecord = {
  id: number
  rank: SatisfactionRank | null
  table_number: string | null
  reservation_name: string | null
  reservation_time: string | null
  visit_reason: string | null
  impression: string | null
  created_at: string
  updated_at: string
}

export type MeetingStatus = 'recorded' | 'transcribing' | 'transcribed' | 'summarizing' | 'done' | 'error'

export type Meeting = {
  id: number
  meeting_date: string
  category: string
  title: string | null
  memo: string | null
  audio_url: string | null
  transcript: string | null
  summary_overview: string | null
  summary_decisions: string | null
  summary_action_items: string | null
  status: MeetingStatus
  error_message: string | null
  created_at: string
  updated_at: string
}
