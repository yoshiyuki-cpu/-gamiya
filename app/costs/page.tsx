'use client'

import { useState } from 'react'
import { useCosts } from '@/hooks/useCosts'
import type { CostResult } from '@/hooks/useCosts'
import { DEFAULT_TARGET_RATE, INGREDIENT_CATEGORIES, UNITS, groupIngredients, parseNumber, percent, suggestedPrice, unitPriceLabel, usageCount, yen } from '@/lib/costs'
import IngredientOptions from './_components/IngredientOptions'
import type { MenuCost } from '@/lib/costs'
import { RECIPE_CATEGORIES } from '@/lib/recipes'
import type { Ingredient } from '@/lib/supabase'
import TrialPanel from './_components/TrialPanel'

export const dynamic = 'force-dynamic'

type Tab = 'menu' | 'ingredients' | 'trial'

/** 1つのメニュー。開くと売価・目標・材料を直せる。 */
function MenuRow({
  item,
  ingredients,
  saving,
  onUpdate,
  onSetLine,
  onRemoveLine,
}: {
  item: MenuCost
  ingredients: Ingredient[]
  saving: boolean
  onUpdate: (patch: { price?: number | null; target_rate?: number | null; active?: boolean; name?: string }) => Promise<CostResult>
  onSetLine: (ingredientId: number, qty: number) => Promise<CostResult>
  onRemoveLine: (lineId: number) => Promise<CostResult>
}) {
  const { menu } = item
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState(menu.price != null ? String(menu.price) : '')
  const [target, setTarget] = useState(menu.target_rate != null ? String(menu.target_rate) : '')
  const [newIng, setNewIng] = useState('')
  const [newQty, setNewQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = async (p: Promise<CostResult>) => {
    setError(null)
    const r = await p
    if (!r.ok) setError(r.error)
    return r.ok
  }

  const savePrice = () => {
    const p = price.trim() === '' ? null : parseNumber(price)
    const t = target.trim() === '' ? null : parseNumber(target)
    if (price.trim() !== '' && p === null) return setError('売価は数字で入れてください。')
    if (target.trim() !== '' && (t === null || t <= 0 || t >= 100)) return setError('目標原価率は 1〜99 で入れてください。')
    void run(onUpdate({ price: p, target_rate: t }))
  }

  const addLine = async () => {
    const id = Number(newIng)
    const q = parseNumber(newQty)
    if (!id) return setError('材料を選んでください。')
    if (q === null || q <= 0) return setError('量を数字で入れてください。')
    if (await run(onSetLine(id, q))) {
      setNewIng('')
      setNewQty('')
    }
  }

  const rateClass = item.rate === null ? '' : item.overTarget ? ' cs-rate-over' : ' cs-rate-ok'
  const suggest = suggestedPrice(item.cost, menu.target_rate)

  return (
    <div className={`cs-row${item.overTarget ? ' cs-row-over' : ''}`}>
      <button type="button" className="cs-row-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cs-name">
          {menu.name}
          {item.missingIngredient ? <span className="cs-warn">材料が消えています</span> : null}
        </span>
        <span className="cs-nums">
          <span className="cs-price">{menu.price != null ? yen(menu.price) : '売価なし'}</span>
          <span className="cs-cost">原価 {yen(item.cost)}</span>
        </span>
        <span className={`cs-rate${rateClass}`}>{percent(item.rate)}</span>
        <span className={`category-chevron${open ? '' : ' collapsed'}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <div className="st-form">
          <div className="rv-row-2">
            <label className="rv-field">
              <span className="satisfaction-label">売価(円)</span>
              <input className="satisfaction-input" inputMode="numeric" placeholder="1200" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={savePrice} />
            </label>
            <label className="rv-field">
              <span className="satisfaction-label">目標原価率(%)</span>
              <input
                className="satisfaction-input"
                inputMode="numeric"
                placeholder={String(DEFAULT_TARGET_RATE)}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onBlur={savePrice}
              />
            </label>
          </div>

          <div className="cs-lines">
            <div className="satisfaction-label">1皿に使う材料</div>
            {item.lines.length === 0 ? <div className="cs-empty">まだ材料がありません。下から足してください。</div> : null}
            {item.lines.map((l) => (
              <div key={l.line.id} className="cs-line">
                <span className="cs-line-name">{l.ingredient?.name ?? '(消された材料)'}</span>
                <span className="cs-line-qty">
                  {l.line.qty}
                  {l.ingredient?.unit ?? ''}
                </span>
                <span className="cs-line-cost">{yen(l.cost)}</span>
                <button type="button" className="cs-line-del" aria-label="外す" disabled={saving} onClick={() => void run(onRemoveLine(l.line.id))}>
                  ×
                </button>
              </div>
            ))}
            <div className="cs-add-line">
              <select className="satisfaction-input" value={newIng} onChange={(e) => setNewIng(e.target.value)} aria-label="材料">
                <IngredientOptions ingredients={ingredients} />
              </select>
              <input className="satisfaction-input cs-qty-input" inputMode="decimal" placeholder="量" value={newQty} onChange={(e) => setNewQty(e.target.value)} aria-label="量" />
              <button type="button" className="st-btn" disabled={saving} onClick={() => void addLine()}>
                足す
              </button>
            </div>
          </div>

          <div className="cs-summary">
            <span>原価 {yen(item.cost)}</span>
            <span>原価率 {percent(item.rate)}</span>
            {suggest !== null ? <span className="cs-suggest">目標{menu.target_rate ?? DEFAULT_TARGET_RATE}%なら売価 {yen(suggest)}〜</span> : null}
          </div>

          {error ? <div className="recorder-error">{error}</div> : null}

          <button
            type="button"
            className="visit-delete-btn"
            disabled={saving}
            onClick={() => {
              if (window.confirm(`「${menu.name}」を一覧から消します(記録は残ります)。よろしいですか?`)) void run(onUpdate({ active: false }))
            }}
          >
            このメニューを一覧から消す
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** 1つの材料。開くと買う量と値段を直せる。 */
function IngredientRow({
  ing,
  usedIn,
  saving,
  onUpdate,
}: {
  ing: Ingredient
  usedIn: number
  saving: boolean
  onUpdate: (patch: Partial<Ingredient>) => Promise<CostResult>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(ing.name)
  const [unit, setUnit] = useState(ing.unit)
  const [category, setCategory] = useState(ing.category ?? 'other')
  const [qty, setQty] = useState(String(ing.pack_qty))
  const [priceText, setPriceText] = useState(String(ing.pack_price))
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const q = parseNumber(qty)
    const p = parseNumber(priceText)
    if (!name.trim()) return setError('名前を入れてください。')
    if (q === null || q <= 0) return setError('買う量は 0 より大きい数字で入れてください。')
    if (p === null) return setError('値段は数字で入れてください。')
    setError(null)
    const r = await onUpdate({ name: name.trim(), category, unit, pack_qty: q, pack_price: p })
    if (!r.ok) setError(r.error)
    else setOpen(false)
  }

  return (
    <div className="cs-row">
      <button type="button" className="cs-row-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="cs-name">{ing.name}</span>
        <span className="cs-nums">
          <span className="cs-price">
            {ing.pack_qty}
            {ing.unit} {yen(ing.pack_price)}
          </span>
          <span className="cs-cost">{usedIn > 0 ? `${usedIn}品で使用` : '未使用'}</span>
        </span>
        <span className="cs-rate">{unitPriceLabel(ing)}</span>
        <span className={`category-chevron${open ? '' : ' collapsed'}`} aria-hidden="true">
          ▼
        </span>
      </button>
      {open ? (
        <div className="st-form">
          <div className="rv-row-2">
            <label className="rv-field">
              <span className="satisfaction-label">名前</span>
              <input className="satisfaction-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="rv-field rv-field-size">
              <span className="satisfaction-label">分類</span>
              <select className="satisfaction-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rv-row-2">
            <label className="rv-field">
              <span className="satisfaction-label">買う量</span>
              <input className="satisfaction-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="rv-field rv-field-size">
              <span className="satisfaction-label">単位</span>
              <select className="satisfaction-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="rv-field">
              <span className="satisfaction-label">その値段(円)</span>
              <input className="satisfaction-input" inputMode="numeric" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
            </label>
          </div>
          {error ? <div className="recorder-error">{error}</div> : null}
          <div className="st-form-actions">
            <button type="button" className="next-guest-btn" disabled={saving} onClick={() => void save()}>
              この内容で保存
            </button>
            <button
              type="button"
              className="visit-delete-btn"
              disabled={saving || usedIn > 0}
              onClick={() => {
                if (window.confirm(`「${ing.name}」を一覧から消します(記録は残ります)。よろしいですか?`)) void onUpdate({ active: false })
              }}
            >
              {usedIn > 0 ? `${usedIn}品のメニューで使っているので消せません` : 'この材料を一覧から消す'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function CostsPage() {
  const costs = useCosts()
  const [tab, setTab] = useState<Tab>('menu')
  const [error, setError] = useState<string | null>(null)

  // 追加フォーム
  const [menuName, setMenuName] = useState('')
  const [menuCategory, setMenuCategory] = useState<string>(RECIPE_CATEGORIES[0].id)
  const [menuPrice, setMenuPrice] = useState('')
  const [ingName, setIngName] = useState('')
  const [ingUnit, setIngUnit] = useState<string>('g')
  const [ingCategory, setIngCategory] = useState<string>('meat')
  const [ingQty, setIngQty] = useState('')
  const [ingPrice, setIngPrice] = useState('')

  const submitMenu = async () => {
    setError(null)
    if (!menuName.trim()) return setError('メニューの名前を入れてください。')
    const p = menuPrice.trim() === '' ? null : parseNumber(menuPrice)
    if (menuPrice.trim() !== '' && p === null) return setError('売価は数字で入れてください。')
    const r = await costs.addMenu({ name: menuName.trim(), category: menuCategory, price: p, target_rate: null })
    if (!r.ok) return setError(r.error)
    setMenuName('')
    setMenuPrice('')
  }

  const submitIngredient = async () => {
    setError(null)
    const q = parseNumber(ingQty)
    const p = parseNumber(ingPrice)
    if (!ingName.trim()) return setError('材料の名前を入れてください。')
    if (q === null || q <= 0) return setError('買う量は 0 より大きい数字で入れてください。')
    if (p === null) return setError('値段は数字で入れてください。')
    const r = await costs.addIngredient({ name: ingName.trim(), category: ingCategory, unit: ingUnit, pack_qty: q, pack_price: p })
    if (!r.ok) return setError(r.error)
    setIngName('')
    setIngQty('')
    setIngPrice('')
  }

  if (costs.loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  const over = costs.costs.filter((c) => c.overTarget).length
  const activeIngredients = costs.ingredients.filter((i) => i.active)

  return (
    <div className="app">
      <div className="header">
        <div className="eyebrow">GAMIYA</div>
        <h1 className="title">原価</h1>
        <div className="subtitle">
          メニュー{costs.costs.length}品 ・ 目標を超えている{over}品 ・ 材料{activeIngredients.length}種
        </div>
      </div>

      {costs.loadError ? <div className="recorder-error rv-error">{costs.loadError}</div> : null}
      {error ? <div className="recorder-error rv-error">{error}</div> : null}

      <div className="view-toggle">
        <button type="button" className={`view-toggle-btn${tab === 'menu' ? ' active' : ''}`} onClick={() => setTab('menu')}>
          メニュー{over > 0 ? `(超過${over})` : ''}
        </button>
        <button type="button" className={`view-toggle-btn${tab === 'ingredients' ? ' active' : ''}`} onClick={() => setTab('ingredients')}>
          材料と仕入れ値
        </button>
        <button type="button" className={`view-toggle-btn${tab === 'trial' ? ' active' : ''}`} onClick={() => setTab('trial')}>
          試算
        </button>
      </div>

      {tab === 'trial' ? (
        <TrialPanel ingredients={costs.ingredients} saving={costs.saving} onRegister={costs.addMenuWithLines} />
      ) : null}

      {tab === 'menu' ? (
        <>
          <div className="category">
            <div className="category-head">
              <div className="badge">原</div>
              <div>
                <div className="category-name">メニューごとの原価率</div>
                <div className="category-sub">原価率の高い順。名前を押すと売価と材料を直せます</div>
              </div>
            </div>
            <div className="items">
              {costs.costs.length === 0 ? (
                <div className="empty-hint">
                  {activeIngredients.length === 0
                    ? 'まず「材料と仕入れ値」で、肉やタレの買う量と値段を入れてください。そのあと下からメニューを足します。'
                    : 'まだメニューがありません。下から足してください。'}
                </div>
              ) : (
                costs.costs.map((c) => (
                  <MenuRow
                    key={c.menu.id}
                    item={c}
                    ingredients={costs.ingredients}
                    saving={costs.saving}
                    onUpdate={(patch) => costs.updateMenu(c.menu.id, patch)}
                    onSetLine={(ingredientId, qty) => costs.setLine(c.menu.id, ingredientId, qty)}
                    onRemoveLine={costs.removeLine}
                  />
                ))
              )}
            </div>
            <div className="satisfaction-body">
              <label className="satisfaction-label">メニューを足す</label>
              <input className="satisfaction-input" placeholder="例) 上カルビ" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
              <div className="rv-row-2">
                <label className="rv-field">
                  <span className="satisfaction-label">分類</span>
                  <select className="satisfaction-input" value={menuCategory} onChange={(e) => setMenuCategory(e.target.value)}>
                    {RECIPE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rv-field">
                  <span className="satisfaction-label">売価(円)</span>
                  <input className="satisfaction-input" inputMode="numeric" placeholder="1800" value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)} />
                </label>
              </div>
              <button type="button" className="next-guest-btn" disabled={costs.saving} onClick={() => void submitMenu()}>
                メニューを足す
              </button>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'ingredients' ? (
        <>
          {activeIngredients.length === 0 ? (
            <div className="category">
              <div className="empty-hint">まだ材料がありません。下から足してください。「1000gを3,800円で買う」のように入れると、円/gが出ます。</div>
            </div>
          ) : null}
          {groupIngredients(activeIngredients)
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.category.id} className="category">
                <div className="category-head">
                  <div className="badge">{g.category.badge}</div>
                  <div>
                    <div className="category-name">{g.category.name}</div>
                    <div className="category-sub">{g.items.length}種 ・ 名前を押すと直せます</div>
                  </div>
                </div>
                <div className="items">
                  {g.items.map((ing) => (
                    <IngredientRow
                      key={ing.id}
                      ing={ing}
                      usedIn={usageCount(ing.id, costs.lines.filter((l) => costs.menus.some((m) => m.id === l.menu_item_id && m.active)))}
                      saving={costs.saving}
                      onUpdate={(patch) => costs.updateIngredient(ing.id, patch)}
                    />
                  ))}
                </div>
              </div>
            ))}
          <div className="category">
          <div className="category-head">
            <div className="badge">材</div>
            <div>
              <div className="category-name">材料を足す</div>
              <div className="category-sub">「1000gを3,800円で買う」のように入れると、円/gが出ます。値段が変わったらここを直すだけ</div>
            </div>
          </div>
          <div className="satisfaction-body">
            <div className="rv-row-2">
              <label className="rv-field">
                <span className="satisfaction-label">名前</span>
                <input className="satisfaction-input" placeholder="例) カルビ" value={ingName} onChange={(e) => setIngName(e.target.value)} />
              </label>
              <label className="rv-field rv-field-size">
                <span className="satisfaction-label">分類</span>
                <select className="satisfaction-input" value={ingCategory} onChange={(e) => setIngCategory(e.target.value)} aria-label="分類">
                  {INGREDIENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rv-row-2">
              <label className="rv-field">
                <span className="satisfaction-label">買う量</span>
                <input className="satisfaction-input" inputMode="decimal" placeholder="1000" value={ingQty} onChange={(e) => setIngQty(e.target.value)} />
              </label>
              <label className="rv-field rv-field-size">
                <span className="satisfaction-label">単位</span>
                <select className="satisfaction-input" value={ingUnit} onChange={(e) => setIngUnit(e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rv-field">
                <span className="satisfaction-label">その値段(円)</span>
                <input className="satisfaction-input" inputMode="numeric" placeholder="3800" value={ingPrice} onChange={(e) => setIngPrice(e.target.value)} />
              </label>
            </div>
            <button type="button" className="next-guest-btn" disabled={costs.saving} onClick={() => void submitIngredient()}>
              材料を足す
            </button>
          </div>
          </div>
        </>
      ) : null}

      <div className="footer">
        <div className="footer-note">
          原価 = 1皿に使う材料の量 × 仕入れ値。原価率 = 原価 ÷ 売価。目標(決めなければ{DEFAULT_TARGET_RATE}%)を超えたメニューは赤で出ます。
          仕入れ値が変わったら「材料と仕入れ値」で直すと、全メニューの原価が変わります。
        </div>
      </div>
    </div>
  )
}
