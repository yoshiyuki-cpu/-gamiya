export default function DoneBanner({ show }: { show: boolean }) {
  return (
    <div className={`done-banner${show ? ' show' : ''}`}>
      🔥 準備完了!今日も一日よろしくお願いします
    </div>
  )
}
