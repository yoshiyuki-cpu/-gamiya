'use client'

import { useState } from 'react'
import { useGuestStats, PERIODS, PERIOD_LABEL } from '@/hooks/useGuestStats'
import type { StatsPeriod } from '@/hooks/useGuestStats'
import { useGuestVisits } from '@/hooks/useGuestVisits'
import type { VisitPatch } from '@/hooks/useGuestVisits'
import { percent } from '@/lib/guestStats'
import type { Tally } from '@/lib/guestStats'
import { seatsLabel, slotLabel } from '@/lib/reservations'
import type { GuestSatisfactionRecord, SatisfactionRank } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const RANKS: SatisfactionRank[] = ['S', 'A', 'B', 'C', 'D', 'E']

function VisitEditor({
  visit,
  onSave,
  onDelete,
}: {
  visit: GuestSatisfactionRecord
  onSave: (patch: VisitPatch) => void
  onDelete: () => void
}) {
  const [rank, setRank] = useState<SatisfactionRank | null>(visit.rank)
  const [name, setName] = useState(visit.reservation_name ?? '')
  const [time, setTime] = useState(visit.reservation_time ?? '')
  const [table, setTable] = useState(visit.table_number ?? '')
  const [visitReason, setVisitReason] = useState(visit.visit_reason ?? '')
  const [impression, setImpression] = useState(visit.impression ?? '')
  const [isRegular, setIsRegular] = useState(visit.is_regular ?? false)

  return (
    <div className="visit-editor">
      <div className="visit-editor-row">
        <input
          className="satisfaction-input visit-name-input"
          placeholder="ご予約名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="satisfaction-input visit-time-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <input
          className="satisfaction-input visit-table-input"
          placeholder="卓"
          value={table}
          onChange={(e) => setTable(e.target.value)}
        />
      </div>
      <div className="rank-row">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            className={`rank-btn${rank === r ? ' active' : ''}`}
            onClick={() => setRank(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {visit.is_regular !== undefined ? (
        <label className={`regular-check${isRegular ? ' checked' : ''}`}>
          <input type="checkbox" checked={isRegular} onChange={(e) => setIsRegular(e.target.checked)} />
          <span className="regular-check-box" aria-hidden="true">
            {isRegular ? '✓' : ''}
          </span>
          <span className="regular-check-text">常連さん</span>
        </label>
      ) : null}
      <label className="satisfaction-label">来客動機</label>
      <textarea
        className="satisfaction-input"
        placeholder="例)家族の誕生日、会社の飲み会、近くて初めて来店 など"
        value={visitReason}
        onChange={(e) => setVisitReason(e.target.value)}
      />
      <label className="satisfaction-label">お客様の声(なんと言って帰られたか)</label>
      <textarea
        className="satisfaction-input"
        placeholder="例)「タンが最高だった」「また来ます」など帰り際の一言・楽しんでいた様子"
        value={impression}
        onChange={(e) => setImpression(e.target.value)}
      />
      <button
        className="next-guest-btn satisfaction-submit"
        type="button"
        onClick={() =>
          onSave({
            rank,
            reservation_name: name.trim() || null,
            reservation_time: time.trim() || null,
            table_number: table.trim() || null,
            visit_reason: visitReason.trim() || null,
            impression: impression.trim() || null,
            ...(visit.is_regular !== undefined ? { is_regular: isRegular } : {}),
          })
        }
      >
        保存する
      </button>
      <button className="visit-delete-btn" type="button" onClick={onDelete}>
        この組を削除
      </button>
    </div>
  )
}

function TallyPercent({ part, whole }: { part: number; whole: number }) {
  const p = percent(part, whole)
  return p == null ? null : <span className="gs-pct"> ({p}%)</span>
}

function BandCard({ label, tally, all, highlight }: { label: string; tally: Tally; all: number; highlight?: boolean }) {
  const share = percent(tally.groups, all)
  const regularShare = percent(tally.regular, tally.groups)
  return (
    <div className={`gs-band${highlight ? ' gs-band-key' : ''}`}>
      <div className="gs-band-head">
        <span className="gs-band-label">{label}</span>
        <span className="gs-band-groups">
          <strong>{tally.groups}</strong>組{share != null ? <span className="gs-pct"> 全体の{share}%</span> : null}
        </span>
      </div>
      <div className="gs-bar" aria-hidden="true">
        <span className="gs-bar-regular" style={{ width: `${regularShare ?? 0}%` }} />
      </div>
      <div className="gs-band-foot">
        {tally.groups === 0 ? (
          <span>この時間帯の組はありません</span>
        ) : (
          <>
            <span>
              常連さん <strong>{tally.regular}組</strong>
              {regularShare != null ? ` (${regularShare}%)` : ''}
            </span>
            <span>
              それ以外 <strong>{tally.groups - tally.regular}組</strong>
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default function GuestsPage() {
  const {
    loading,
    visits,
    totalCount,
    ratedCount,
    pendingReservations,
    addVisit,
    importReservation,
    importAllReservations,
    updateVisit,
    deleteVisit,
  } = useGuestVisits()

  const [newName, setNewName] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newTable, setNewTable] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // 取り込み中の二度押しを防ぐ。忙しい時間帯に連打されがちなため。
  const [importing, setImporting] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [period, setPeriod] = useState<StatsPeriod>('today')
  const statsKey = visits.map((v) => `${v.id}:${v.reservation_time ?? ''}:${v.is_regular ? 1 : 0}`).join(',')
  const { loading: statsLoading, available: statsAvailable, stats } = useGuestStats(period, statsKey)

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  const allRated = totalCount > 0 && ratedCount === totalCount

  const handleAdd = async () => {
    if (!newName.trim() && !newTime.trim() && !newTable.trim()) return
    await addVisit(newName, newTime, newTable)
    setNewName('')
    setNewTime('')
    setNewTable('')
  }

  const runImport = async (task: () => Promise<void>) => {
    if (importing) return
    setImporting(true)
    try {
      await task()
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">お客様評価</h1>
            <div className="subtitle">
              本日{totalCount}組 ・ 評価済み{ratedCount}件
            </div>
          </div>
        </div>
      </div>

      {saveNotice ? <div className="recorder-error">{saveNotice}</div> : null}

      <div className={`done-banner${allRated ? ' show' : ''}`}>✅ 本日の全組に評価がつきました!</div>

      {pendingReservations.length > 0 ? (
        <div className="category">
          <div className="category-head">
            <div className="badge">予</div>
            <div>
              <div className="category-name">本日の予約から取り込む</div>
              <div className="category-sub">予約表に入っていて、まだ台帳にない{pendingReservations.length}組</div>
            </div>
          </div>
          <div className="items">
            {pendingReservations.map((r) => (
              <div key={r.id} className="pending-row">
                <span className="visit-time">{slotLabel(r.start_slot)}</span>
                <span className="history-table">{seatsLabel(r.seats)}</span>
                <span className="visit-name">
                  {r.name ?? '(名前なし)'}
                  {r.party_size ? ` ${r.party_size}名` : ''}
                </span>
                <button
                  className="pending-import-btn"
                  type="button"
                  disabled={importing}
                  onClick={() => runImport(() => importReservation(r))}
                >
                  取り込む
                </button>
              </div>
            ))}
          </div>
          <div className="satisfaction-body">
            <button
              className="next-guest-btn"
              type="button"
              disabled={importing}
              onClick={() => runImport(importAllReservations)}
            >
              {pendingReservations.length}組すべて取り込む
            </button>
          </div>
        </div>
      ) : null}

      <div className="category">
        <div className="category-head">
          <div className="badge">組</div>
          <div>
            <div className="category-name">組の登録</div>
            <div className="category-sub">ご予約名・時間を入れておき、帰り際に評価をつける</div>
          </div>
        </div>
        <div className="satisfaction-body">
          <div className="visit-editor-row">
            <input
              className="satisfaction-input visit-name-input"
              placeholder="ご予約名(例: 田中様)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="satisfaction-input visit-time-input"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <input
              className="satisfaction-input visit-table-input"
              placeholder="卓"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
            />
          </div>
          <button className="next-guest-btn satisfaction-submit" type="button" onClick={handleAdd}>
            組を登録
          </button>
        </div>
      </div>

      <div className="category">
        <div className="category-head">
          <div className="badge">客</div>
          <div>
            <div className="category-name">本日の組</div>
            <div className="category-sub">タップして評価・お客様の声を記入</div>
          </div>
        </div>
        <div className="items">
          {visits.length === 0 ? (
            <div className="empty-hint">まだ組が登録されていません。上から登録してください。</div>
          ) : null}
          {visits.map((v) => {
            const expanded = expandedId === v.id
            return (
              <div key={v.id} className="visit-row">
                <div
                  className="visit-row-head"
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(expanded ? null : v.id)}
                >
                  {v.rank ? (
                    <span className={`rank-badge rank-badge-${v.rank}`}>{v.rank}</span>
                  ) : (
                    <span className="unrated-chip">未評価</span>
                  )}
                  <span className="visit-name">{v.reservation_name ?? '(名前なし)'}</span>
                  {v.is_regular ? <span className="regular-chip">常連</span> : null}
                  {v.reservation_id != null ? <span className="from-rv-chip">予約</span> : null}
                  {v.reservation_time ? <span className="visit-time">{v.reservation_time}</span> : null}
                  {v.table_number ? <span className="history-table">卓{v.table_number}</span> : null}
                  <span className={`category-chevron${expanded ? '' : ' collapsed'}`} aria-hidden="true">
                    ▼
                  </span>
                </div>
                {!expanded && (v.visit_reason || v.impression) ? (
                  <div className="visit-summary">
                    {v.visit_reason ? <div className="history-text">来客動機: {v.visit_reason}</div> : null}
                    {v.impression ? <div className="history-text">お客様の声: {v.impression}</div> : null}
                  </div>
                ) : null}
                {expanded ? (
                  <VisitEditor
                    key={v.id}
                    visit={v}
                    onSave={(patch) => {
                      void updateVisit(v.id, patch).then((r) => {
                        setSaveNotice(
                          r.regularSaved || patch.is_regular === undefined
                            ? null
                            : '評価は保存しましたが、常連さんのチェックは保存できませんでした。Supabaseで supabase-migration-regular-guests.sql を実行してください。',
                        )
                      })
                      setExpandedId(null)
                    }}
                    onDelete={() => {
                      if (window.confirm('この組の記録を削除します。よろしいですか?')) {
                        deleteVisit(v.id)
                        setExpandedId(null)
                      }
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="category">
        <div className="category-head">
          <div className="badge">率</div>
          <div>
            <div className="category-name">組数の割合</div>
            <div className="category-sub">時間帯ごとの組数と、常連さんの割合</div>
          </div>
        </div>
        <div className="satisfaction-body">
          <div className="gs-period" role="group" aria-label="期間">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className={`gs-period-btn${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>

          {!statsAvailable ? (
            <div className="recorder-error">
              常連さんの列がまだありません。Supabaseで supabase-migration-regular-guests.sql を実行してください。
            </div>
          ) : null}

          {statsLoading ? (
            <div className="empty-hint">集計中…</div>
          ) : stats.total.groups === 0 ? (
            <div className="empty-hint">この期間の組はまだありません。</div>
          ) : (
            <>
              <div className="gs-total">
                <span>{PERIOD_LABEL[period]}の合計</span>
                <strong>{stats.total.groups}組</strong>
                <span>
                  うち常連さん <strong>{stats.total.regular}組</strong>
                  <TallyPercent part={stats.total.regular} whole={stats.total.groups} />
                </span>
              </div>

              <div className="gs-bands">
                {stats.bands.map(({ band, tally }) => (
                  <BandCard key={band.id} label={band.label} tally={tally} all={stats.total.groups} highlight />
                ))}
                <BandCard label="それ以外の時間" tally={stats.other} all={stats.total.groups} />
                {stats.noTime.groups > 0 ? (
                  <BandCard label="時間が未入力" tally={stats.noTime} all={stats.total.groups} />
                ) : null}
              </div>
              <div className="footer-note">
                ご予約時間で数えています。「17:00〜18:00」は18:00ちょうどを含まず、「22:00〜25:00」は25:00ちょうどを含みません(25:00 = 翌1:00)。割合は四捨五入です。
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footer">
        <div className="footer-note">
          組の登録・評価は全端末で共有されます。記録は営業日(昼12時区切り)ごとにこのページに表示されます。
        </div>
      </div>
    </div>
  )
}
