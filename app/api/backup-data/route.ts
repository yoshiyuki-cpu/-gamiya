import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { backupFileName, backupSummary, buildBackupMail, MAX_ATTACHMENT_BYTES, takeBackup } from '@/lib/backup'
import { rejectIfNotCron } from '@/lib/lineNotify'
import { sendMail } from '@/lib/mail'

// Vercel Cron から毎日(日本時間の朝4時)呼ばれる。全部の表を読み出して、
// 1つのファイルにして、REPORT_MAIL_TO にメールで送る(バックアップ)。
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
// 将来、公開用の鍵では読めなくなったときのために、サービスキーがあればそちらを使う。
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function handle(req: NextRequest) {
  const rejected = rejectIfNotCron(req)
  if (rejected) return rejected

  const backup = await takeBackup(supabase)
  const summary = backupSummary(backup)

  const json = JSON.stringify(
    { takenAt: backup.takenAt, tables: Object.fromEntries(Object.entries(backup.tables).filter(([, d]) => !d.missing).map(([k, d]) => [k, d.rows])) },
    null,
    1,
  )
  const buf = Buffer.from(json, 'utf-8')
  const attach = buf.byteLength <= MAX_ATTACHMENT_BYTES
  const mailBody = buildBackupMail(backup, attach)
  const mail = await sendMail(
    mailBody.subject,
    mailBody.text,
    attach ? [{ filename: backupFileName(backup.takenAt), content: buf.toString('base64') }] : undefined,
  )

  if (summary.failed.length > 0 || mail.status === 'failed') console.error('backup-data problem', summary.failed, mail.status)
  return NextResponse.json({ mail: mail.status, attached: attach, bytes: buf.byteLength, rows: summary.total, failed: summary.failed })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

// 手動テスト用。Vercel Cron 自体は GET で叩いてくる。
export async function POST(req: NextRequest) {
  return handle(req)
}
