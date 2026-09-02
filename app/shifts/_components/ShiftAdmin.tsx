'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { dayLabel, POSITION_LABEL, ROLE_LABEL, weekdayOf, type DayStatus, type StaffMember } from '@/lib/shifts'
import type { ShiftAssignment, ShiftRequest, ShiftRequirement, ShiftSettings, StaffName } from '@/lib/supabase'

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

// 設定を開いていたかどうかを覚えておく置き場。
const SETTINGS_OPEN_KEY = 'gamiya-shift-settings-open'

function DayRow({
  status,
  requests,
  assignments,
  members,
  expanded,
  busy,
  onToggle,
  onAssign,
}: {
  status: DayStatus
  requests: ShiftRequest[]
  assignments: ShiftAssignment[]
  members: StaffMember[]
  expanded: boolean
  busy: boolean
  onToggle: () => void
  onAssign: (name: string) => void
}) {
  const wd = weekdayOf(status.date)
  const assignedNames = new Set(assignments.filter((a) => a.work_date === status.date).map((a) => a.staff_name))
  const dayRequests = requests.filter((r) => r.work_date === status.date)
  const offNames = new Set(dayRequests.filter((r) => r.kind === 'off').map((r) => r.staff_name))
  const wantNames = new Set(dayRequests.filter((r) => r.kind === 'want').map((r) => r.staff_name))

  const short = status.shortage > 0
  const over = status.surplus > 0
  const detail: string[] = []
  if (status.staffShortage > 0) detail.push('社員なし')
  if (status.hallShortage > 0) detail.push(`ホール-${status.hallShortage}`)
  if (status.kitchenShortage > 0) detail.push(`キッチン-${status.kitchenShortage}`)

  return (
    <div className={`sh-day${short ? ' sh-day-short' : over ? ' sh-day-over' : ''}`}>
      <div
        className={`sh-day-head${wd === 0 ? ' sh-sun' : wd === 6 ? ' sh-sat' : ''}`}
        role="button"
        tabIndex={0}
        onClick={onToggle}
      >
        <span className="sh-day-date">{dayLabel(status.date)}</span>
        <span className="sh-day-count">
          {status.assigned.length}/{status.need.total_needed}人
        </span>
        <span className="sh-day-spacer" />
        {short ? <span className="sh-chip sh-chip-short">{status.shortage}人不足</span> : null}
        {over ? <span className="sh-chip sh-chip-over">{status.surplus}人多い</span> : null}
        <span className={`category-chevron${expanded ? '' : ' collapsed'}`} aria-hidden="true">
          ▼
        </span>
      </div>

      {/* 内訳は行が長くなるので、チップにせず下の行へ回す。 */}
      {detail.length > 0 ? <div className="sh-day-detail">{detail.join(' / ')}</div> : null}

      {!expanded && status.assigned.length > 0 ? (
        <div className="sh-day-names">{status.assigned.map((m) => m.name).join('、')}</div>
      ) : null}

      {expanded ? (
        <div className="sh-day-body">
          <div className="sh-day-hint">名前を押すと、その日に入れる／外すが切り替わります。</div>
          <div className="sh-member-grid">
            {members.map((m) => {
              const isOff = offNames.has(m.name)
              const isOn = assignedNames.has(m.name)
              const wants = wantNames.has(m.name)
              return (
                <button
                  key={m.name}
                  type="button"
                  className={`sh-member${isOn ? ' on' : ''}${isOff ? ' off' : ''}${wants ? ' want' : ''}`}
                  disabled={busy}
                  onClick={() => onAssign(m.name)}
                  title={isOff ? '休み希望' : wants ? '入りたい' : ''}
                >
                  <span className="sh-member-name">{m.name}</span>
                  <span className="sh-member-tag">
                    {m.role === 'staff' ? '社' : ''}
                    {m.position === 'hall' ? 'ホ' : m.position === 'kitchen' ? 'キ' : '両'}
                    {isOff ? ' 休' : wants ? ' 希' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ShiftAdmin({
  statuses,
  requests,
  assignments,
  members,
  staff,
  requirements,
  settings,
  notSubmitted,
  deadline,
  busy,
  onAssign,
  onAutoFill,
  onClear,
  onSaveRequirement,
  onSaveSettings,
  onSaveStaff,
}: {
  statuses: DayStatus[]
  requests: ShiftRequest[]
  assignments: ShiftAssignment[]
  members: StaffMember[]
  staff: StaffName[]
  requirements: ShiftRequirement[]
  settings: ShiftSettings | null
  notSubmitted: StaffMember[]
  deadline: string
  busy: boolean
  onAssign: (name: string, date: string) => void
  onAutoFill: () => void
  onClear: () => void
  onSaveRequirement: (weekday: number, patch: Record<string, number>) => void
  onSaveSettings: (patch: Record<string, number>) => void
  onSaveStaff: (name: string, patch: Record<string, string | boolean>) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  // 打っている途中の値。保存されたら消して、保存された値を出す。
  const [draft, setDraft] = useState<Record<string, string>>({})

  // まだ保存していない入力。欄から離れる前にメニューが閉じても
  // 送れるよう、画面の状態とは別にここへ持っておく。
  const pending = useRef<Record<string, { typed: string; stored: number; save: (value: number) => void }>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** たまっている入力をまとめて保存する。 */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const entries = Object.entries(pending.current)
    if (entries.length === 0) return
    pending.current = {}
    setDraft({})
    for (const [, item] of entries) {
      const value = Number(item.typed)
      if (!Number.isFinite(value) || item.typed.trim() === '' || value < 0 || value === item.stored) continue
      item.save(value)
    }
  }, [])

  /**
   * 打つたびに予約しておき、手が止まったら保存する。
   * 「欄から離れたとき」だけに任せると、離れないままメニューを閉じたり
   * 画面が作り直されたりしたときに、入力がそのまま消える。
   */
  const changeNumber = (slot: string, typed: string, stored: number, save: (value: number) => void) => {
    setDraft((d) => ({ ...d, [slot]: typed }))
    pending.current[slot] = { typed, stored, save }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }

  // 画面から外れるときも、打ちかけを取りこぼさない。
  useEffect(() => flush, [flush])

  // 設定を開いているかどうかは、この画面が作り直されても保つ。
  // 勝手に閉じると、入力の途中だったのか分からなくなる。
  const [showSettings, setShowSettings] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.sessionStorage.getItem(SETTINGS_OPEN_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleSettings = () => {
    // 閉じる前に、打ちかけを保存してしまう。
    flush()
    const next = !showSettings
    setShowSettings(next)
    try {
      window.sessionStorage.setItem(SETTINGS_OPEN_KEY, next ? '1' : '0')
    } catch {
      // 保存できなくても開け閉めそのものは使える。
    }
  }

  const shortDays = statuses.filter((s) => s.shortage > 0)
  const overDays = statuses.filter((s) => s.surplus > 0)

  return (
    <>
      <div className="category">
        <div className="category-head">
          <div className="badge">状</div>
          <div>
            <div className="category-name">この期間の状況</div>
            <div className="category-sub">締め切り {deadline.replace(/^\d+-/, '').replace('-', '/')}</div>
          </div>
        </div>
        <div className="satisfaction-body">
          <div className="sh-summary">
            <div className="sh-summary-cell">
              <div className="sh-summary-num">{shortDays.length}</div>
              <div className="sh-summary-label">足りない日</div>
            </div>
            <div className="sh-summary-cell">
              <div className="sh-summary-num">{overDays.length}</div>
              <div className="sh-summary-label">多すぎる日</div>
            </div>
            <div className="sh-summary-cell">
              <div className="sh-summary-num">{notSubmitted.length}</div>
              <div className="sh-summary-label">未提出</div>
            </div>
          </div>

          {notSubmitted.length > 0 ? (
            <div className="sh-warn">まだ希望を出していない人: {notSubmitted.map((m) => m.name).join('、')}</div>
          ) : null}

          <div className="sh-actions">
            <button className="next-guest-btn" type="button" disabled={busy} onClick={onAutoFill}>
              空いている日を自動で埋める
            </button>
            <button className="sh-clear-btn" type="button" disabled={busy} onClick={onClear}>
              この期間の確定を全部消す
            </button>
          </div>
        </div>
      </div>

      <div className="category">
        <div className="category-head">
          <div className="badge">日</div>
          <div>
            <div className="category-name">日ごとのシフト</div>
            <div className="category-sub">赤=足りない / 黄=多すぎる</div>
          </div>
        </div>
        <div className="items">
          {statuses.map((s) => (
            <DayRow
              key={s.date}
              status={s}
              requests={requests}
              assignments={assignments}
              members={members}
              expanded={expanded === s.date}
              busy={busy}
              onToggle={() => setExpanded(expanded === s.date ? null : s.date)}
              onAssign={(name) => onAssign(name, s.date)}
            />
          ))}
        </div>
      </div>

      <div className="category">
        <div className="category-head" role="button" tabIndex={0} onClick={toggleSettings}>
          <div className="badge">設</div>
          <div>
            <div className="category-name">必要人数とスタッフの設定</div>
            <div className="category-sub">曜日ごとの人数・社員/アルバイト・ホール/キッチン</div>
          </div>
          <span className={`category-chevron${showSettings ? '' : ' collapsed'}`} aria-hidden="true">
            ▼
          </span>
        </div>

        {showSettings ? (
          <div className="satisfaction-body">
            <label className="satisfaction-label">曜日ごとの必要人数</label>
            <div className="sh-need-head">
              <span />
              <span>合計</span>
              <span>ホール</span>
              <span>キッチン</span>
              <span>社員</span>
            </div>
            {WEEKDAY_NAMES.map((label, weekday) => {
              const r = requirements.find((x) => x.weekday === weekday)
              return (
                <div key={weekday} className="sh-need-row">
                  <span className={`sh-need-day${weekday === 0 ? ' sh-sun' : weekday === 6 ? ' sh-sat' : ''}`}>{label}</span>
                  {(['total_needed', 'hall_needed', 'kitchen_needed', 'staff_needed'] as const).map((field) => {
                    const slot = `${weekday}-${field}`
                    const stored = r?.[field] ?? 0
                    return (
                      <input
                        key={field}
                        className="satisfaction-input sh-need-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={20}
                        // 打っている間だけ手元の値を出し、離れたら保存された値に戻す。
                        // 入力欄まかせにすると、保存できなかった数字が画面に
                        // 残り続けて、保存できたように見えてしまう。
                        value={draft[slot] ?? String(stored)}
                        onChange={(e) =>
                          changeNumber(slot, e.target.value, stored, (value) =>
                            onSaveRequirement(weekday, { [field]: value }),
                          )
                        }
                        onBlur={flush}
                      />
                    )
                  })}
                </div>
              )
            })}

            <label className="satisfaction-label">希望提出の締め切り</label>
            <div className="sh-deadline-row">
              <span>前半(1〜15日)は前の月の</span>
              <input
                className="satisfaction-input sh-need-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={draft.first ?? String(settings?.first_half_deadline_day ?? 20)}
                onChange={(e) =>
                  changeNumber('first', e.target.value, settings?.first_half_deadline_day ?? 20, (value) =>
                    onSaveSettings({ first_half_deadline_day: value }),
                  )
                }
                onBlur={flush}
              />
              <span>日まで</span>
            </div>
            <div className="sh-deadline-row">
              <span>後半(16〜末日)は同じ月の</span>
              <input
                className="satisfaction-input sh-need-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={draft.second ?? String(settings?.second_half_deadline_day ?? 5)}
                onChange={(e) =>
                  changeNumber('second', e.target.value, settings?.second_half_deadline_day ?? 5, (value) =>
                    onSaveSettings({ second_half_deadline_day: value }),
                  )
                }
                onBlur={flush}
              />
              <span>日まで</span>
            </div>

            <label className="satisfaction-label">スタッフの区分</label>
            {staff.map((s) => (
              <div key={s.name} className="sh-staff-row">
                <span className="sh-staff-name">{s.name}</span>
                <select
                  className="satisfaction-input sh-staff-select"
                  value={s.role}
                  onChange={(e) => onSaveStaff(s.name, { role: e.target.value })}
                >
                  {(['staff', 'parttime'] as const).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <select
                  className="satisfaction-input sh-staff-select"
                  value={s.position}
                  onChange={(e) => onSaveStaff(s.name, { position: e.target.value })}
                >
                  {(['hall', 'kitchen', 'both'] as const).map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`sh-active-btn${s.active === false ? ' off' : ''}`}
                  onClick={() => onSaveStaff(s.name, { active: s.active === false })}
                >
                  {s.active === false ? '休止中' : '在籍'}
                </button>
              </div>
            ))}
            <div className="sh-submitted-note">
              スタッフの追加・名前の訂正は「勤怠」の画面で行えます。ここでは区分だけを変えられます。
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
