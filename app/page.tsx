'use client'

import { useChecklist } from '@/hooks/useChecklist'
import CategoryCard from './_components/CategoryCard'
import DoneBanner from './_components/DoneBanner'
import Footer from './_components/Footer'
import Header from './_components/Header'

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
    toggleTimer,
    resetTimer,
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
            onToggleCheck={toggleCheck}
            onSetQuantity={setQuantity}
            onToggleTimer={toggleTimer}
            onResetTimer={resetTimer}
            onMoveItem={moveItem}
            onToggleQuantityMode={toggleQuantityMode}
            onDeleteItem={deleteItem}
            onAddItemsBulk={addItemsBulk}
          />
        ))}
      </div>

      <Footer editMode={editMode} onReset={resetDailyChecks} onRestore={restoreDefaults} />
    </div>
  )
}
