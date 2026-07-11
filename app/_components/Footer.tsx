export default function Footer({
  editMode,
  onReset,
  onRestore,
}: {
  editMode: boolean
  onReset: () => void
  onRestore: () => void
}) {
  return (
    <div className="footer">
      {!editMode ? (
        <button className="reset-btn" type="button" onClick={onReset}>
          本日の記録をリセット
        </button>
      ) : null}
      {editMode ? (
        <button className="restore-btn" type="button" onClick={onRestore}>
          最初のチェックリストに戻す
        </button>
      ) : null}
      <div className="footer-note">
        {editMode
          ? '編集した内容は次の日以降もこのまま引き継がれます。'
          : 'チェック・個数はこの日付の分だけ保存されます。日付が変わると自動で新しいシートになります。'}
      </div>
    </div>
  )
}
