'use client'

import type { WallOrder } from '@/lib/supabase'

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Props = {
  orders: WallOrder[]
  onComplete: (orderId: number) => void
}

export default function OrderList({ orders, onComplete }: Props) {
  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">中</div>
        <div>
          <div className="category-name">対応中の注文</div>
          <div className="category-sub">{orders.length}件</div>
        </div>
      </div>
      <div className="items">
        {orders.length === 0 ? (
          <div className="empty-hint">対応中の注文はありません</div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="order-item">
              <span className="order-table-badge">卓{o.table_number}</span>
              <span className="item-text">
                {o.item_name} × {o.quantity}
              </span>
              <span className="time-badge">{timeLabel(o.created_at)}</span>
              {o.staff_name ? <span className="staff-badge">{o.staff_name}</span> : null}
              <button type="button" className="order-complete-btn" onClick={() => onComplete(o.id)}>
                完了
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
