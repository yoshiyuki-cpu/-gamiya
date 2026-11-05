import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * バックアップに入れる表。新しい表を作ったら、ここにも足す。
 * (一覧は supabase-*.sql の create table から拾っている。画像は表ではなく Storage にあるので入らない)
 */
export const BACKUP_TABLES = [
  'categories',
  'items',
  'staff_names',
  'daily_records',
  'daily_reports',
  'meetings',
  'reflections',
  'report_checks',
  'post_checks',
  'turnaway_counts',
  'time_entries',
  'time_breaks',
  'reservations',
  'guest_satisfaction_records',
  'guest_check_sessions',
  'guest_check_items',
  'wall_menu_items',
  'wall_orders',
  'x_posts',
  'recipes',
  'ingredients',
  'menu_items',
  'menu_ingredients',
  'suppliers',
  'stock_rules',
  'stock_orders',
  'shift_settings',
  'shift_requirements',
  'shift_requirement_overrides',
  'shift_requests',
  'shift_submissions',
  'shift_assignments',
  'deadlines',
] as const

const PAGE = 1000
/** メールに付けられる大きさの上限(Resend は添付込みで約40MB。base64で膨らむので余裕を見る)。 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export type TableDump = { rows: Record<string, unknown>[]; error?: string; missing?: boolean }
export type BackupResult = { takenAt: string; tables: Record<string, TableDump> }

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(error.message ?? '')
}

/** 1つの表を、1000行ずつ最後まで読む。表が無ければ missing(使っていない表は失敗にしない)。 */
export async function dumpTable(client: SupabaseClient, table: string): Promise<TableDump> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      if (isMissingTable(error)) return { rows: [], missing: true }
      // 主キーが id でない表(staff_names など)は、並び順を付けずに読み直す。
      if (from === 0 && error.code === '42703') return dumpWithoutOrder(client, table)
      return { rows, error: error.message }
    }
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }
  return { rows }
}

async function dumpWithoutOrder(client: SupabaseClient, table: string): Promise<TableDump> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select('*').range(from, from + PAGE - 1)
    if (error) return { rows, error: error.message }
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }
  return { rows }
}

export async function takeBackup(client: SupabaseClient, tables: readonly string[] = BACKUP_TABLES): Promise<BackupResult> {
  const result: BackupResult = { takenAt: new Date().toISOString(), tables: {} }
  for (const table of tables) result.tables[table] = await dumpTable(client, table)
  return result
}

export function backupSummary(b: BackupResult): { total: number; lines: string[]; failed: string[] } {
  const lines: string[] = []
  const failed: string[] = []
  let total = 0
  for (const [name, dump] of Object.entries(b.tables)) {
    if (dump.missing) continue
    if (dump.error) {
      failed.push(`${name}(${dump.error})`)
      continue
    }
    total += dump.rows.length
    lines.push(`・${name}: ${dump.rows.length}件`)
  }
  return { total, lines, failed }
}

export function backupFileName(takenAt: string): string {
  return `gamiya-backup-${takenAt.slice(0, 10)}.json`
}

export function buildBackupMail(b: BackupResult, attached: boolean): { subject: string; text: string } {
  const { total, lines, failed } = backupSummary(b)
  const day = b.takenAt.slice(0, 10)
  const text = [
    `がみやアプリのデータを自動でバックアップしました(${day})。`,
    attached
      ? `添付の「${backupFileName(b.takenAt)}」が、その時点の全データです。消さずに残してください。`
      : 'データが大きすぎてメールに添付できませんでした。Supabaseの画面から、バックアップを取ってください。',
    failed.length > 0 ? `\n読めなかった表があります(バックアップに入っていません):\n${failed.join('\n')}` : '',
    `\n合計 ${total}件\n${lines.join('\n')}`,
    '\n※ 写真(レシピの写真など)は、この中に入りません。\n※ お客様のお名前などが入っています。他の人に転送しないでください。',
  ]
    .filter((s) => s !== '')
    .join('\n')
  return { subject: `【がみや】データのバックアップ ${day}${failed.length > 0 ? '(一部読めず)' : ''}`, text }
}
