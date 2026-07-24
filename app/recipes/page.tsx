'use client'

import { useState } from 'react'
import { useRecipes } from '@/hooks/useRecipes'
import { RECIPE_CATEGORIES } from '@/lib/recipes'
import type { Recipe } from '@/lib/supabase'
import RecipeCategorySection from './_components/RecipeCategorySection'
import RecipeDetail from './_components/RecipeDetail'

export const dynamic = 'force-dynamic'

function matchesSearch(recipe: Recipe, query: string): boolean {
  if (!query) return true
  return (
    recipe.name.toLowerCase().includes(query) ||
    (recipe.ingredients ?? '').toLowerCase().includes(query) ||
    (recipe.steps ?? '').toLowerCase().includes(query) ||
    (recipe.notes ?? '').toLowerCase().includes(query)
  )
}

export default function RecipesPage() {
  const { recipes, loading, addRecipe, updateRecipe, deleteRecipe, uploadPhoto } = useRecipes()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const selected = recipes.find((r) => r.id === selectedId) ?? null
  const query = search.trim().toLowerCase()

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

  const categorySections = RECIPE_CATEGORIES.map((cat) => ({
    cat,
    matches: recipes.filter((r) => r.category === cat.id && matchesSearch(r, query)),
  }))
  const noResults = query !== '' && categorySections.every((c) => c.matches.length === 0)

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
        <>
          <div className="recipe-search">
            <input
              type="text"
              className="recipe-search-input"
              placeholder="レシピを検索(名前・材料など)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button type="button" className="recipe-search-clear" aria-label="検索をクリア" onClick={() => setSearch('')}>
                ×
              </button>
            ) : null}
          </div>

          {noResults ? <div className="empty-hint">「{search}」に一致するレシピが見つかりません</div> : null}

          {categorySections.map(({ cat, matches }) => {
            if (query && matches.length === 0) return null
            return (
              <RecipeCategorySection
                key={cat.id}
                categoryId={cat.id}
                badge={cat.badge}
                name={cat.name}
                sub={cat.sub}
                recipes={matches}
                onSelect={(r) => setSelectedId(r.id)}
                onAdd={handleAdd}
              />
            )
          })}
        </>
      )}
    </div>
  )
}
