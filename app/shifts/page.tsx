'use client'

import { useState } from 'react'
import { useShifts } from '@/hooks/useShifts'
import { todayKey } from '@/lib/checklist'
import { nextPeriod, periodLabel, periodOf, prevPeriod, type ShiftPeriod } from '@/lib/shifts'
import RequestSheet from './_components/RequestSheet'
import ShiftAdmin from './_components/ShiftAdmin'

export const dynamic = 'force-dynamic'

const NAME_KEY = 'gamiya-shift-name'

// これを過ぎても返事がなければ、押せないまま固まらせずに諦める。
// 電波の悪い店内で1回詰まると、以後どのボタンも押せなくなるため。
const SAVE_TIMEOUT_MS = 12000

export default function ShiftsPage() {
  // 既定は「次に組む期間」。今の期間はもう動かせないことが多いため。
  const [period, setPeriod] = useState<ShiftPeriod>(() => nextPeriod(periodOf(todayKey())))
  const [tab, setTab] = useState<'request' | 'admin'>('request')
  const [name, setName] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shifts = useShifts(period)

  const pickName = (value: string) => {
    setName(value)
    try {
      window.localStorage.setItem(NAME_KEY, value)
    } catch {
      // プライベートモードなどで保存できなくても、その場の入力は使える。
    }
  }

  // 保存に失敗したら必ず画面に出す。黙って失敗すると、現場では
  // 「ボタンが押せない」としか見えず、原因にたどり着けない。
  // 返事が返ってこないときも、押せないまま固まらないように打ち切る。
  const run = async (task: () => Promise<{ ok: boolean; error?: string } | void>) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await Promise.race([
        task(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), SAVE_TIMEOUT_MS)),
      ])
      setError(result && !result.ok ? (result.error ?? '保存できませんでした。') : null)
    } catch (e) {
      console.error('shift action failed', e)
      setError(
        e instanceof Error && e.message === 'timeout'
          ? '保存に時間がかかっています。電波を確かめて、もう一度押してください。'
          : '保存できませんでした。通信を確かめて、もう一度押してください。',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">シフト</h1>
            <div className="subtitle">
              {shifts.loading
                ? '読み込み中…'
                : `足りない日${shifts.shortageDays.length} ・ 多すぎる日${shifts.surplusDays.length} ・ 偏り${shifts.biasDays.length}日 ・ 未提出${shifts.notSubmitted.length}人`}
            </div>
          </div>
        </div>
      </div>

      <div className="rv-date-nav">
        <button className="tc-month-btn" type="button" onClick={() => setPeriod(prevPeriod(period))} aria-label="前の期間">
          ◀
        </button>
        <div className="rv-date-label">{periodLabel(period)}</div>
        <button className="tc-month-btn" type="button" onClick={() => setPeriod(nextPeriod(period))} aria-label="次の期間">
          ▶
        </button>
      </div>

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${tab === 'request' ? ' active' : ''}`} onClick={() => setTab('request')}>
          休み希望を出す
        </button>
        <button type="button" className={`view-toggle-btn${tab === 'admin' ? ' active' : ''}`} onClick={() => setTab('admin')}>
          店長
        </button>
      </div>

      {error ? <div className="recorder-error rv-error">{error}</div> : null}

      {shifts.loading ? (
        <div className="empty-hint">読み込み中…</div>
      ) : tab === 'request' ? (
        <>
          <div className="category">
            <div className="category-head">
              <div className="badge">名</div>
              <div>
                <div className="category-name">名前を選ぶ</div>
                <div className="category-sub">一度選べば、次からはこの端末で覚えています</div>
              </div>
            </div>
            <div className="satisfaction-body">
              <div className="table-chips">
                {shifts.members.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    className={`table-chip${name === m.name ? ' active' : ''}`}
                    onClick={() => pickName(m.name)}
                  >
                    {m.name}
                    {shifts.submittedNames.has(m.name) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              {shifts.members.length === 0 ? (
                <div className="empty-hint">スタッフが登録されていません。「勤怠」の画面から追加してください。</div>
              ) : null}
            </div>
          </div>

          {name ? (
            <RequestSheet
              name={name}
              dates={shifts.dates}
              requests={shifts.requests}
              submitted={shifts.submittedNames.has(name)}
              busy={busy}
              onSet={(date, kind) => run(() => shifts.setRequest(name, date, kind))}
              onSubmit={() => run(() => shifts.submit(name))}
            />
          ) : (
            <div className="empty-hint">上から自分の名前を選んでください。</div>
          )}
        </>
      ) : (
        <ShiftAdmin
          statuses={shifts.statuses}
          requests={shifts.requests}
          assignments={shifts.assignments}
          members={shifts.members}
          staff={shifts.staff}
          requirements={shifts.requirements}
          settings={shifts.settings}
          notSubmitted={shifts.notSubmitted}
          deadline={shifts.deadline}
          busy={busy}
          onAssign={(staffName, date) => run(() => shifts.toggleAssignment(staffName, date))}
          onAutoFill={() =>
            run(async () => {
              const result = await shifts.autoFill()
              if (result.ok && result.added === 0) {
                window.alert('埋められる日はありませんでした。休み希望が多いか、既に埋まっています。')
              }
              return result
            })
          }
          onClear={() => {
            if (window.confirm('この期間の確定をすべて消します。休み希望は消えません。よろしいですか?')) {
              run(() => shifts.clearAssignments())
            }
          }}
          onSaveRequirement={(weekday, patch) => run(() => shifts.saveRequirement(weekday, patch))}
          onSaveSettings={(patch) => run(() => shifts.saveSettings(patch))}
          onSaveStaff={(staffName, patch) => run(() => shifts.saveStaff(staffName, patch))}
        />
      )}

      <div className="footer">
        <div className="footer-note">
          押していない日は「出られる」扱いです。休みたい日と、できれば入りたい日だけを押してください。
          締め切りまでは何度でも直せます。
        </div>
      </div>
    </div>
  )
}
