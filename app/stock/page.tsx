'use client'

import { useMemo, useState } from 'react'
import { useStock } from '@/hooks/useStock'
import type { StockAlertRow } from '@/hooks/useStock'
import { buildOrderText, groupBySupplier, mailtoLink } from '@/lib/stock'
import type { Supplier } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const NAME_KEY = 'gamiya-shift-name'

function unitOf(unit: string | null): string {
  return unit ?? '個'
}

/** 発注した日時は UTC で保存されるので、端末の時刻(日本)で月/日にする。 */
function orderedLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10).replace('-', '/')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function readStaffName(): string | null {
  try {
    return window.localStorage.getItem(NAME_KEY)
  } catch {
    return null
  }
}

/** 発注先ごとの1かたまり。メールを開く・文面をコピー・発注した、をここで済ませる。 */
function SupplierGroup({
  supplier,
  alerts,
  busy,
  onOrdered,
}: {
  supplier: Supplier | null
  alerts: StockAlertRow[]
  busy: boolean
  onOrdered: () => void
}) {
  const [copied, setCopied] = useState(false)
  const name = supplier?.name ?? '発注先が未設定'
  const text = buildOrderText(
    supplier?.name ?? '担当者',
    alerts.map((a) => ({ itemName: a.itemName, qty: a.rule.order_qty, unit: a.rule.unit })),
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('この文をコピーしてください', text)
    }
  }

  return (
    <div className="st-group">
      <div className="st-group-head">
        <span className="st-group-name">{name}</span>
        {supplier?.note ? <span className="st-group-note">{supplier.note}</span> : null}
      </div>
      <div className="st-lines">
        {alerts.map((a) => (
          <div key={a.item_id} className="st-line">
            <span className="st-line-name">{a.itemName}</span>
            <span className="st-line-now">
              残り{a.quantity}
              {unitOf(a.rule.unit)}
              <span className="st-line-th">(規定{a.rule.threshold})</span>
            </span>
            <span className="st-line-arrow">→</span>
            <span className="st-line-qty">
              {a.rule.order_qty}
              {unitOf(a.rule.unit)}
            </span>
          </div>
        ))}
      </div>
      <div className="st-actions">
        {supplier?.email ? (
          <a className="st-btn st-btn-mail" href={mailtoLink(supplier.email, '発注のお願い(焼肉GAMIYA)', text)}>
            ✉ メールを開く
          </a>
        ) : (
          <span className="st-no-mail">メールアドレスが未設定です(下の「発注先」で入れられます)</span>
        )}
        <button type="button" className="st-btn" onClick={copy}>
          {copied ? 'コピーしました' : '発注文をコピー'}
        </button>
        <button type="button" className="st-btn st-btn-done" disabled={busy} onClick={onOrdered}>
          発注した
        </button>
      </div>
    </div>
  )
}

export default function StockPage() {
  const stock = useStock()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'need' | 'rules'>('need')

  // 決めごとの編集
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [form, setForm] = useState({ threshold: '', order_qty: '', unit: '', supplier_id: '' })
  // 発注先の追加
  const [supName, setSupName] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supNote, setSupNote] = useState('')

  const run = async (task: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await task()
      setError(r.ok ? null : (r.error ?? '保存できませんでした。'))
    } catch (e) {
      console.error(e)
      setError('保存できませんでした。通信を確かめて、もう一度押してください。')
    } finally {
      setBusy(false)
    }
  }

  const groups = useMemo(() => groupBySupplier(stock.alerts), [stock.alerts])
  const ruleByItem = useMemo(() => new Map(stock.rules.map((r) => [r.item_id, r])), [stock.rules])
  const itemsWithoutRule = stock.items.filter((i) => !ruleByItem.has(i.id))

  const startEdit = (itemId: number) => {
    const r = ruleByItem.get(itemId)
    setForm({
      threshold: r ? String(r.threshold) : '',
      order_qty: r ? String(r.order_qty) : '',
      unit: r?.unit ?? '',
      supplier_id: r?.supplier_id != null ? String(r.supplier_id) : '',
    })
    setEditingItemId(itemId)
  }

  const submitRule = (itemId: number, active = true) =>
    run(async () => {
      const threshold = Number(form.threshold)
      const orderQty = Number(form.order_qty)
      if (!Number.isFinite(threshold) || threshold < 0) return { ok: false, error: '規定数は0以上の数で入れてください。' }
      if (!Number.isFinite(orderQty) || orderQty <= 0) return { ok: false, error: '発注数は1以上の数で入れてください。' }
      const r = await stock.saveRule({
        item_id: itemId,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        threshold,
        order_qty: orderQty,
        unit: form.unit.trim() || null,
        active,
      })
      if (r.ok) setEditingItemId(null)
      return r
    })

  const submitSupplier = () =>
    run(async () => {
      if (!supName.trim()) return { ok: false, error: '発注先の名前を入れてください。' }
      const r = await stock.saveSupplier({
        name: supName.trim(),
        email: supEmail.trim() || null,
        note: supNote.trim() || null,
      })
      if (r.ok) {
        setSupName('')
        setSupEmail('')
        setSupNote('')
      }
      return r
    })

  if (stock.loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="top-row">
          <div>
            <div className="eyebrow">GAMIYA</div>
            <h1 className="title">発注</h1>
            <div className="subtitle">
              {stock.alerts.length > 0 ? `発注が必要 ${stock.alerts.length}品目` : '発注が必要な品目はありません'}
              {' ・ '}決めごと{stock.rules.filter((r) => r.active).length}件
            </div>
          </div>
        </div>
      </div>

      {stock.missingTable ? (
        <div className="recorder-error rv-error">
          在庫の表がデータベースにまだありません。Supabaseで supabase-migration-stock.sql を実行してください。
        </div>
      ) : null}
      {error ? <div className="recorder-error rv-error">{error}</div> : null}

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${tab === 'need' ? ' active' : ''}`} onClick={() => setTab('need')}>
          発注が必要{stock.alerts.length > 0 ? `(${stock.alerts.length})` : ''}
        </button>
        <button type="button" className={`view-toggle-btn${tab === 'rules' ? ' active' : ''}`} onClick={() => setTab('rules')}>
          品目と発注先
        </button>
      </div>

      {tab === 'need' ? (
        <>
          <div className="category">
            <div className="category-head">
              <div className="badge">注</div>
              <div>
                <div className="category-name">発注が必要な品目</div>
                <div className="category-sub">開店前チェックの数量で規定数を下回ったもの。発注したら3日間は出ません</div>
              </div>
            </div>
            <div className="satisfaction-body">
              {stock.alerts.length === 0 ? (
                <div className="empty-hint">
                  {stock.rules.length === 0
                    ? '「品目と発注先」で、どの品目を何個下回ったら発注するかを決めてください。'
                    : '今日はありません。'}
                </div>
              ) : (
                [...groups.entries()].map(([supplierId, list]) => (
                  <SupplierGroup
                    key={supplierId ?? 'none'}
                    supplier={list[0].supplier}
                    alerts={list}
                    busy={busy}
                    onOrdered={() => {
                      if (window.confirm(`${list.map((a) => a.itemName).join('、')} を発注済みにします。よろしいですか?`)) {
                        run(() => stock.markOrdered(list, readStaffName()))
                      }
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {stock.orders.length > 0 ? (
            <div className="category">
              <div className="category-head">
                <div className="badge">歴</div>
                <div>
                  <div className="category-name">発注した記録</div>
                  <div className="category-sub">直近30日</div>
                </div>
              </div>
              <div className="items">
                {stock.orders.map((o) => (
                  <div key={o.id} className="st-history">
                    <span className="st-history-date">{orderedLabel(o.ordered_at)}</span>
                    <span className="visit-name">{stock.itemById.get(o.item_id)?.text ?? `品目#${o.item_id}`}</span>
                    <span className="st-history-qty">
                      {o.qty}
                      {unitOf(o.unit)}
                    </span>
                    <span className="st-history-sup">
                      {o.supplier_id != null ? (stock.supplierById.get(o.supplier_id)?.name ?? '') : ''}
                    </span>
                    {o.staff_name ? <span className="st-history-staff">{o.staff_name}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="category">
            <div className="category-head">
              <div className="badge">品</div>
              <div>
                <div className="category-name">品目の決めごと</div>
                <div className="category-sub">開店前チェックで「数量入力」にした項目が、ここに出ます</div>
              </div>
            </div>
            <div className="items">
              {stock.items.length === 0 ? (
                <div className="empty-hint">
                  開店前チェックに数量入力の項目がありません。「編集」から項目を「数量入力」に切り替えてください。
                </div>
              ) : null}
              {stock.items.map((item) => {
                const rule = ruleByItem.get(item.id)
                const qty = stock.quantities[item.id]
                const counted = stock.countedOn[item.id]
                const editing = editingItemId === item.id
                const below = rule && rule.active && qty != null && qty < rule.threshold
                return (
                  <div key={item.id} className={`st-rule${below ? ' st-rule-below' : ''}${rule && !rule.active ? ' st-rule-off' : ''}`}>
                    <div
                      className="st-rule-head"
                      role="button"
                      tabIndex={0}
                      onClick={() => (editing ? setEditingItemId(null) : startEdit(item.id))}
                    >
                      <span className="visit-name">{item.text}</span>
                      <span className="st-rule-qty">
                        {qty != null ? `残り${qty}${unitOf(rule?.unit ?? null)}` : '未カウント'}
                        {counted && counted !== stock.today ? <span className="st-rule-old">({counted.slice(5).replace('-', '/')})</span> : null}
                      </span>
                      <span className="st-rule-meta">
                        {rule
                          ? rule.active
                            ? `規定${rule.threshold} → ${rule.order_qty}${unitOf(rule.unit)}`
                            : '止めている'
                          : '未設定'}
                      </span>
                      <span className={`category-chevron${editing ? '' : ' collapsed'}`} aria-hidden="true">
                        ▼
                      </span>
                    </div>

                    {editing ? (
                      <div className="st-form">
                        <div className="rv-row-2">
                          <label className="rv-field">
                            <span className="satisfaction-label">この数を下回ったら</span>
                            <input
                              className="satisfaction-input"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              placeholder="5"
                              value={form.threshold}
                              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                            />
                          </label>
                          <label className="rv-field">
                            <span className="satisfaction-label">発注する数</span>
                            <input
                              className="satisfaction-input"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              placeholder="10"
                              value={form.order_qty}
                              onChange={(e) => setForm({ ...form, order_qty: e.target.value })}
                            />
                          </label>
                          <label className="rv-field rv-field-size">
                            <span className="satisfaction-label">単位</span>
                            <input
                              className="satisfaction-input"
                              placeholder="袋"
                              value={form.unit}
                              onChange={(e) => setForm({ ...form, unit: e.target.value })}
                            />
                          </label>
                        </div>
                        <label className="rv-field">
                          <span className="satisfaction-label">発注先</span>
                          <select
                            className="satisfaction-input"
                            value={form.supplier_id}
                            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                          >
                            <option value="">(未設定)</option>
                            {stock.suppliers
                              .filter((s) => s.active)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="st-form-actions">
                          <button type="button" className="next-guest-btn" disabled={busy} onClick={() => submitRule(item.id)}>
                            この内容で保存
                          </button>
                          {rule ? (
                            <button
                              type="button"
                              className="visit-delete-btn"
                              disabled={busy}
                              onClick={() => submitRule(item.id, !rule.active)}
                            >
                              {rule.active ? 'この品目の発注を止める(記録は残ります)' : '発注を再開する'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {itemsWithoutRule.length > 0 && stock.rules.length > 0 ? (
              <div className="st-hint">未設定が{itemsWithoutRule.length}件あります。名前を押すと決められます。</div>
            ) : null}
          </div>

          <div className="category">
            <div className="category-head">
              <div className="badge">先</div>
              <div>
                <div className="category-name">発注先</div>
                <div className="category-sub">メールアドレスを入れると、宛先入りのメールを1タップで開けます</div>
              </div>
            </div>
            <div className="items">
              {stock.suppliers.map((s) => (
                <div key={s.id} className="st-supplier">
                  <span className="visit-name">{s.name}</span>
                  <span className="st-supplier-mail">{s.email ?? 'メール未設定'}</span>
                  {s.note ? <span className="st-supplier-note">{s.note}</span> : null}
                </div>
              ))}
            </div>
            <div className="satisfaction-body">
              <label className="satisfaction-label">発注先を追加</label>
              <input
                className="satisfaction-input"
                placeholder="例) キンリューフーズ"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
              />
              <input
                className="satisfaction-input"
                type="email"
                inputMode="email"
                placeholder="order@example.co.jp"
                value={supEmail}
                onChange={(e) => setSupEmail(e.target.value)}
              />
              <input
                className="satisfaction-input"
                placeholder="例) 15時締め・翌日納品 / 担当:山田さん"
                value={supNote}
                onChange={(e) => setSupNote(e.target.value)}
              />
              <button type="button" className="next-guest-btn" disabled={busy} onClick={submitSupplier}>
                発注先を追加
              </button>
            </div>
          </div>
        </>
      )}

      <div className="footer">
        <div className="footer-note">
          在庫の数は開店前チェックの数量入力から取ります。規定数を下回った品目があると、毎日17時15分にLINEで知らせます。
          メールは自動では送りません。宛先と文面が入った状態で開くので、内容を見て送ってください。
        </div>
      </div>
    </div>
  )
}
