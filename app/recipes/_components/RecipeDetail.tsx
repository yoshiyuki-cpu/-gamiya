'use client'

import { useRef, useState } from 'react'
import type { Recipe } from '@/lib/supabase'

export default function RecipeDetail({
  recipe,
  onBack,
  onUpdate,
  onDelete,
  onUploadPhoto,
}: {
  recipe: Recipe
  onBack: () => void
  onUpdate: (patch: Partial<Recipe>) => void
  onDelete: () => void
  onUploadPhoto: (file: File) => Promise<string | null>
}) {
  const [name, setName] = useState(recipe.name)
  const [prepTime, setPrepTime] = useState(recipe.prep_time ?? '')
  const [ingredients, setIngredients] = useState(recipe.ingredients ?? '')
  const [steps, setSteps] = useState(recipe.steps ?? '')
  const [notes, setNotes] = useState(recipe.notes ?? '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="meeting-detail">
      <button type="button" className="meeting-back-btn" onClick={onBack}>
        ← 一覧に戻る
      </button>

      <label className="meeting-field-label">レシピ名</label>
      <input
        className="meeting-title-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onUpdate({ name: name.trim() || recipe.name })}
      />

      <label className="meeting-field-label">調理時間の目安</label>
      <input
        className="meeting-title-input"
        placeholder="例) 15分"
        value={prepTime}
        onChange={(e) => setPrepTime(e.target.value)}
        onBlur={() => onUpdate({ prep_time: prepTime.trim() || null })}
      />

      {recipe.photo_url ? <img className="recipe-photo" src={recipe.photo_url} alt={recipe.name} /> : null}
      {uploading ? <div className="meeting-processing">写真をアップロード中…</div> : null}
      <input
        ref={fileInputRef}
        className="recipe-photo-input"
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          setUploading(true)
          const url = await onUploadPhoto(file)
          setUploading(false)
          if (url) onUpdate({ photo_url: url })
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />

      <label className="meeting-field-label">材料・分量</label>
      <textarea
        className="meeting-textarea"
        rows={5}
        placeholder={'例)\n牛タン 150g\nネギ塩ダレ 大さじ2'}
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        onBlur={() => onUpdate({ ingredients: ingredients || null })}
      />

      <label className="meeting-field-label">作り方の手順</label>
      <textarea
        className="meeting-textarea"
        rows={6}
        placeholder={'例)\n1. タンを1cm厚にスライスする\n2. ネギ塩ダレをからめる'}
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        onBlur={() => onUpdate({ steps: steps || null })}
      />

      <label className="meeting-field-label">メモ(コツ・注意点)</label>
      <textarea
        className="meeting-textarea"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onUpdate({ notes: notes || null })}
      />

      <button type="button" className="meeting-delete-btn" onClick={onDelete}>
        このレシピを削除
      </button>
    </div>
  )
}
