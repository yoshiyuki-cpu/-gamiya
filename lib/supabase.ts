import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
