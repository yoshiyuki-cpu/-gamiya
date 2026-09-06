'use client'

import { groupIngredients, unitPriceLabel } from '@/lib/costs'
import type { Ingredient } from '@/lib/supabase'

/** 材料を選ぶ <select> の中身。肉・野菜・海鮮・調味料・その他でまとめて出す。 */
export default function IngredientOptions({ ingredients, withPrice = false }: { ingredients: Ingredient[]; withPrice?: boolean }) {
  const groups = groupIngredients(ingredients.filter((i) => i.active)).filter((g) => g.items.length > 0)
  return (
    <>
      <option value="">材料を選ぶ</option>
      {groups.map((g) => (
        <optgroup key={g.category.id} label={g.category.name}>
          {g.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}({withPrice ? unitPriceLabel(i) : i.unit})
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
