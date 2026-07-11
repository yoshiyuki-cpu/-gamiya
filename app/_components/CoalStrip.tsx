import type { DailyRecord, Item } from '@/lib/supabase'
import { isDone } from '@/lib/checklist'

export default function CoalStrip({
  items,
  dailyRecords,
}: {
  items: Item[]
  dailyRecords: Map<number, DailyRecord>
}) {
  return (
    <div className="coal-strip">
      {items.map((item) => (
        <div key={item.id} className={`coal${isDone(item, dailyRecords.get(item.id)) ? ' lit' : ''}`} />
      ))}
    </div>
  )
}
