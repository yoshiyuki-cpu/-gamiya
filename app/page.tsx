'use client'

import { useChecklist } from '@/hooks/useChecklist'
import AddCategoryForm from './_components/AddCategoryForm'
import CategoryCard from './_components/CategoryCard'
import DeadlineManager from './_components/DeadlineManager'
import DoneBanner from './_components/DoneBanner'
import Footer from './_components/Footer'
import Header from './_components/Header'
import TimeScheduleView from './_components/TimeScheduleView'

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
    deadlines,
    dailyRecords,
    staffList,
    currentStaff,
    setCurrentStaff,
    commitCurrentStaff,
    editMode,
    setEditMode,
    viewMode,
    setViewMode,
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
    setItemDeadline,
    addDeadline,
    deleteDeadline,
    moveDeadline,
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

      {!editMode ? (
        <div className="view-toggle">
          <button
            type="button"
            className={`view-toggle-btn${viewMode === 'category' ? ' active' : ''}`}
            onClick={() => setViewMode('category')}
          >
            カテゴリーで表示
          </button>
          <button
            type="button"
            className={`view-toggle-btn${viewMode === 'time' ? ' active' : ''}`}
            onClick={() => setViewMode('time')}
          >
            時間で表示
          </button>
        </div>
      ) : null}

      {editMode || viewMode === 'category' ? (
        <div id="categories">
          {editMode ? <DeadlineManager deadlines={deadlines} onAdd={addDeadline} onDelete={deleteDeadline} onMove={moveDeadline} /> : null}
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              items={items.filter((i) => i.category_id === category.id)}
              dailyRecords={dailyRecords}
              editMode={editMode}
              staffList={staffList}
              deadlines={deadlines}
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
              onSetItemDeadline={setItemDeadline}
            />
          ))}
          {editMode ? <AddCategoryForm onAdd={addCategory} /> : null}
        </div>
      ) : (
        <TimeScheduleView
          deadlines={deadlines}
          items={items}
          dailyRecords={dailyRecords}
          staffList={staffList}
          onToggleCheck={toggleCheck}
          onSetQuantity={setQuantity}
          onSetItemStaff={setItemStaff}
          onToggleTimer={toggleTimer}
          onResetTimer={resetTimer}
        />
      )}

      <Footer editMode={editMode} onReset={resetDailyChecks} onRestore={restoreDefaults} />
    </div>
  )
}
