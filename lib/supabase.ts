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
  updated_at: string
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
}

export type MeetingStatus = 'recorded' | 'transcribing' | 'transcribed' | 'summarizing' | 'done' | 'error'

export type Meeting = {
  id: number
  meeting_date: string
  title: string | null
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
