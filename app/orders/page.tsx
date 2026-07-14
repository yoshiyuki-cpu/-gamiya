'use client'

import { useWallOrders } from '@/hooks/useWallOrders'
import MenuEditor from './_components/MenuEditor'
import OrderForm from './_components/OrderForm'
import OrderList from './_components/OrderList'

// Same reasoning as app/page.tsx: this page's content is entirely from a
// live Supabase read, nothing meaningful to statically prerender.
export const dynamic = 'force-dynamic'

export default function OrdersPage() {
  const {
    loading,
    menuItems,
    orders,
    staffList,
    currentStaff,
    setCurrentStaff,
    commitCurrentStaff,
    editMode,
    setEditMode,
    addMenuItem,
    deleteMenuItem,
    addOrder,
    completeOrder,
  } = useWallOrders()

  if (loading) {
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
            <h1 className="title">壁紙メニュー注文</h1>
            <div className="subtitle">
              {editMode ? 'メニューの追加・削除ができます' : 'セルフオーダーにない口頭注文をその場でメモ'}
            </div>
          </div>
          <button
            className={`edit-toggle${editMode ? ' active' : ''}`}
            type="button"
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? '完了' : 'メニュー編集'}
          </button>
        </div>

        {!editMode ? (
          <div className="staff-row">
            <label htmlFor="staffInput">担当者</label>
            <input
              type="text"
              id="staffInput"
              list="staffOptions"
              placeholder="名前を入力"
              autoComplete="off"
              value={currentStaff}
              onChange={(e) => setCurrentStaff(e.target.value)}
              onBlur={commitCurrentStaff}
            />
            <datalist id="staffOptions">
              {staffList.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        ) : null}
      </div>

      {editMode ? (
        <MenuEditor menuItems={menuItems} onAdd={addMenuItem} onDelete={deleteMenuItem} />
      ) : (
        <>
          <OrderForm menuItems={menuItems} onAddOrder={addOrder} />
          <OrderList orders={orders} onComplete={completeOrder} />
        </>
      )}
    </div>
  )
}
