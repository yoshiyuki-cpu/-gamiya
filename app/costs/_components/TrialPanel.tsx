'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CostResult } from '@/hooks/useCosts'
import { DEFAULT_TARGET_RATE, parseNumber, percent, priceTable, rateAt, trialCost, unitPriceLabel, yen } from '@/lib/costs'
import type { Ingredient } from '@/lib/supabase'
import IngredientOptions from './IngredientOptions'

const DRAFT_KEY = 'gamiya-cost-trial'

type DraftLine = { ingredientId: number; qty: string }
type Draft = { name: string; price: string; lines: DraftLine[] }

const EMPTY: Draft = { name: '', price: '', lines: [] }

function readDraft(): Draft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return EMPTY
    const d = JSON.parse(raw) as Partial<Draft>
    return { name: d.name ?? '', price: d.price ?? '', lines: Array.isArray(d.lines) ? d.lines : [] }
  } catch {
    return EMPTY
  }
}

function writeDraft(d: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // 保存できない端末でも試算はできる
  }
}

/**
 * 新メニューの試算。材料と量を並べて原価を出し、売価をいくらにすると何%かを見る。
 * 登録しなくても使える。気に入ったら「メニューに登録」で保存できる。
 * 途中でタブを変えても消えないよう、書きかけは端末に覚える。
 */
export default function TrialPanel({
  ingredients,
  saving,
  onRegister,
}: {
  ingredients: Ingredient[]
  saving: boolean
  onRegister: (name: string, price: number | null, lines: { ingredientId: number; qty: number }[]) => Promise<CostResult>
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [newIng, setNewIng] = useState('')
  const [newQty, setNewQty] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // 最初の描画の後に、書きかけを読む(描画時に読むとサーバーと食い違うため)。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(readDraft())
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (loaded) writeDraft(draft)
  }, [draft, loaded])

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients])
  const active = ingredients.filter((i) => i.active)

  const result = useMemo(
    () =>
      trialCost(
        draft.lines
          .map((l) => ({ ingredient: byId.get(l.ingredientId), qty: parseNumber(l.qty) ?? 0 }))
          .filter((l): l is { ingredient: Ingredient; qty: number } => !!l.ingredient),
      ),
    [draft.lines, byId],
  )
  const price = draft.price.trim() === '' ? null : parseNumber(draft.price)
  const rate = rateAt(result.cost, price)
  const table = priceTable(result.cost)

  const addLine = () => {
    setError(null)
    const id = Number(newIng)
    const q = parseNumber(newQty)
    if (!id) return setError('材料を選んでください。')
    if (q === null || q <= 0) return setError('量を数字で入れてください。')
    setDraft((d) => {
      const exists = d.lines.some((l) => l.ingredientId === id)
      return {
        ...d,
        lines: exists ? d.lines.map((l) => (l.ingredientId === id ? { ...l, qty: String(q) } : l)) : [...d.lines, { ingredientId: id, qty: String(q) }],
      }
    })
    setNewIng('')
    setNewQty('')
    setDone(null)
  }

  const register = async () => {
    setError(null)
    if (!draft.name.trim()) return setError('メニューの名前を入れてください。')
    if (draft.price.trim() !== '' && price === null) return setError('売価は数字で入れてください。')
    const lines = draft.lines
      .map((l) => ({ ingredientId: l.ingredientId, qty: parseNumber(l.qty) ?? 0 }))
      .filter((l) => l.qty > 0 && byId.has(l.ingredientId))
    if (lines.length === 0) return setError('材料を1つ以上入れてください。')
    const r = await onRegister(draft.name.trim(), price, lines)
    if (!r.ok) return setError(r.error)
    setDone(`「${draft.name.trim()}」をメニューに登録しました。「メニュー」タブに出ています。`)
    setDraft(EMPTY)
  }

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">試</div>
        <div>
          <div className="category-name">新メニューの試算</div>
          <div className="category-sub">材料と量を並べると原価が出ます。売価を入れると何%かが出ます</div>
        </div>
      </div>

      <div className="satisfaction-body">
        {active.length === 0 ? <div className="empty-hint">先に「材料と仕入れ値」で材料を入れてください。</div> : null}

        <div className="cs-lines">
          <div className="satisfaction-label">使う材料と量</div>
          {result.lines.length === 0 ? <div className="cs-empty">まだ材料がありません。下から足してください。</div> : null}
          {result.lines.map((l) => (
            <div key={l.ingredient.id} className="cs-line cs-trial-line">
              <span className="cs-line-name">
                {l.ingredient.name}
                <span className="cs-line-unit">{unitPriceLabel(l.ingredient)}</span>
              </span>
              <input
                className="satisfaction-input cs-qty-input"
                inputMode="decimal"
                aria-label={`${l.ingredient.name}の量`}
                value={draft.lines.find((x) => x.ingredientId === l.ingredient.id)?.qty ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lines: d.lines.map((x) => (x.ingredientId === l.ingredient.id ? { ...x, qty: e.target.value } : x)) }))
                }
              />
              <span className="cs-line-qty">{l.ingredient.unit}</span>
              <span className="cs-line-cost">{yen(l.cost)}</span>
              <button
                type="button"
                className="cs-line-del"
                aria-label="外す"
                onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((x) => x.ingredientId !== l.ingredient.id) }))}
              >
                ×
              </button>
            </div>
          ))}
          <div className="cs-add-line">
            <select className="satisfaction-input" value={newIng} onChange={(e) => setNewIng(e.target.value)} aria-label="材料">
              <IngredientOptions ingredients={ingredients} withPrice />
            </select>
            <input className="satisfaction-input cs-qty-input" inputMode="decimal" placeholder="量" value={newQty} onChange={(e) => setNewQty(e.target.value)} aria-label="量" />
            <button type="button" className="st-btn" onClick={addLine}>
              足す
            </button>
          </div>
        </div>

        <div className="cs-trial-total">
          <span className="cs-trial-total-label">1皿の原価</span>
          <span className="cs-trial-total-value">{yen(result.cost)}</span>
        </div>

        <label className="rv-field">
          <span className="satisfaction-label">売価を入れてみる(円)</span>
          <input
            className="satisfaction-input"
            inputMode="numeric"
            placeholder="1200"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          />
        </label>
        {price !== null && result.cost > 0 ? (
          <div className={`cs-trial-rate${rate !== null && rate > DEFAULT_TARGET_RATE ? ' cs-rate-over' : ' cs-rate-ok'}`}>
            売価 {yen(price)} なら 原価率 <strong>{percent(rate)}</strong>
            <span className="cs-trial-rate-note">(粗利 {yen(price - result.cost)})</span>
          </div>
        ) : null}

        {table.length > 0 ? (
          <div className="cs-table">
            <div className="satisfaction-label">原価率ごとの売価の目安</div>
            {table.map((row) => (
              <button
                key={row.rate}
                type="button"
                className={`cs-table-row${price === row.price ? ' active' : ''}`}
                onClick={() => setDraft((d) => ({ ...d, price: String(row.price) }))}
              >
                <span className="cs-table-rate">{row.rate}%</span>
                <span className="cs-table-arrow">→</span>
                <span className="cs-table-price">{yen(row.price)}</span>
                <span className="cs-table-profit">粗利 {yen(row.price - result.cost)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="cs-register">
          <label className="rv-field">
            <span className="satisfaction-label">メニューに登録するなら名前</span>
            <input
              className="satisfaction-input"
              placeholder="例) 厚切り上タン"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          {error ? <div className="recorder-error">{error}</div> : null}
          {done ? <div className="x-posted-note">{done}</div> : null}
          <div className="rf-action-row">
            <button type="button" className="next-guest-btn" disabled={saving || result.lines.length === 0} onClick={() => void register()}>
              {saving ? '保存中…' : 'この内容でメニューに登録'}
            </button>
            <button
              type="button"
              className="st-btn"
              onClick={() => {
                setDraft(EMPTY)
                setError(null)
                setDone(null)
              }}
            >
              白紙にする
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
