'use client'

import { useChecklist } from '@/hooks/useChecklist'
import AddCategoryForm from './_components/AddCategoryForm'
import CategoryCard from './_components/CategoryCard'
import DoneBanner from './_components/DoneBanner'
import Footer from './_components/Footer'
import Header from './_components/Header'

// This page's entire content comes from a live Supabase read (categories,
// items, today's records) plus per-device localStorage — there is nothing
// meaningful to statically prerender at build time, and doing so requires
// NEXT_PUBLIC_SUPABASE_URL to be a valid URL during the build itself.
export const dynamic = 'force-dynamic'

export default function Home() {
  const {
    loading,
    categories,
    items,
    dailyRecords,
    staffList,
    currentStaff,
    setCurrentStaff,
    commitCurrentStaff,
    editMode,
    setEditMode,
    total,
    doneCount,
    toggleCheck,
    setQuantity,
    setItemStaff,
    toggleTimer,
    resetTimer,
    addCategory,
    deleteCategory,
    addItemsBulk,
    deleteItem,
    moveItem,
    toggleQuantityMode,
    resetDailyChecks,
    restoreDefaults,
  } = useChecklist()

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <div className="subtitle">読み込み中…</div>
        </div>
      </div>
    )
  }

  const allDone = total > 0 && doneCount === total

  return (
    <div className="app">
      <Header
        editMode={editMode}
        onToggleEditMode={() => setEditMode((v) => !v)}
        currentStaff={currentStaff}
        setCurrentStaff={setCurrentStaff}
        commitCurrentStaff={commitCurrentStaff}
        staffList={staffList}
        items={items}
        dailyRecords={dailyRecords}
        total={total}
        doneCount={doneCount}
      />

      {!editMode ? <DoneBanner show={allDone} /> : null}

      <div id="categories">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            items={items.filter((i) => i.category_id === category.id)}
            dailyRecords={dailyRecords}
            editMode={editMode}
            staffList={staffList}
            onToggleCheck={toggleCheck}
            onSetQuantity={setQuantity}
            onSetItemStaff={setItemStaff}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onMoveItem={moveItem}
            onToggleQuantityMode={toggleQuantityMode}
            onDeleteItem={deleteItem}
            onAddItemsBulk={addItemsBulk}
            onDeleteCategory={deleteCategory}
          />
        ))}
        {editMode ? <AddCategoryForm onAdd={addCategory} /> : null}
      </div>

      <Footer editMode={editMode} onReset={resetDailyChecks} onRestore={restoreDefaults} />
    </div>
  )
}
