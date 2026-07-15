'use client'

import { useState } from 'react'
import { useRecipes } from '@/hooks/useRecipes'
import { RECIPE_CATEGORIES } from '@/lib/recipes'
import type { Recipe } from '@/lib/supabase'
import RecipeCategorySection from './_components/RecipeCategorySection'
import RecipeDetail from './_components/RecipeDetail'

export const dynamic = 'force-dynamic'

export default function RecipesPage() {
  const { recipes, loading, addRecipe, updateRecipe, deleteRecipe, uploadPhoto } = useRecipes()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selected = recipes.find((r) => r.id === selectedId) ?? null

  async function handleAdd(category: string, name: string) {
    const created = await addRecipe(category, name)
    if (created) setSelectedId(created.id)
  }

  async function handleDelete(recipe: Recipe) {
    const deleted = await deleteRecipe(recipe.id, recipe.name)
    if (deleted) setSelectedId(null)
  }

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
            <h1 className="title">レシピ帳</h1>
            <div className="subtitle">肉・サイド・デザート・ドリンクの作り方</div>
          </div>
        </div>
      </div>

      {selected ? (
        <RecipeDetail
          recipe={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={(patch) => updateRecipe(selected.id, patch)}
          onDelete={() => handleDelete(selected)}
          onUploadPhoto={(file) => uploadPhoto(selected.id, file)}
        />
      ) : (
        RECIPE_CATEGORIES.map((cat) => (
          <RecipeCategorySection
            key={cat.id}
            categoryId={cat.id}
            badge={cat.badge}
            name={cat.name}
            sub={cat.sub}
            recipes={recipes.filter((r) => r.category === cat.id)}
            onSelect={(r) => setSelectedId(r.id)}
            onAdd={handleAdd}
          />
        ))
      )}
    </div>
  )
}
