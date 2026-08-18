'use client'

import { useState } from 'react'
import { useXPosts } from '@/hooks/useXPosts'

export default function XPostCard() {
  const { loading, saving, todayPost, streak, monthCount, markPosted, unmarkPosted } = useXPosts()
  const [staffName, setStaffName] = useState('')
  const [memo, setMemo] = useState('')

  if (loading) return null

  const posted = !!todayPost

  return (
    <div className="category">
      <div className="category-head">
        <div className="badge">X</div>
        <div>
          <div className="category-name">X(旧Twitter)の投稿</div>
          <div className="category-sub">目標: 毎日18時前後 ・ 今月{monthCount}日投稿</div>
        </div>
        <span className={`x-status${posted ? ' done' : ''}`}>{posted ? '投稿済み' : '未投稿'}</span>
      </div>

      <div className="satisfaction-body">
        <div className="coal-strip" aria-label={`直近${streak.length}日の投稿状況`}>
          {streak.map((d) => (
            <span key={d.key} className={`coal${d.posted ? ' lit' : ''}`} title={d.key} />
          ))}
        </div>

        {posted ? (
          <>
            <div className="x-posted-note">
              本日は投稿済みです{todayPost?.staff_name ? `(${todayPost.staff_name})` : ''}。18時のLINEリマインドは飛びません。
            </div>
            {todayPost?.memo ? <div className="history-text">内容: {todayPost.memo}</div> : null}
            <button className="visit-delete-btn" type="button" disabled={saving} onClick={() => void unmarkPosted()}>
              取り消す(まだ投稿していない)
            </button>
          </>
        ) : (
          <>
            <label className="satisfaction-label" htmlFor="xStaff">
              投稿した人(任意)
            </label>
            <input
              id="xStaff"
              className="satisfaction-input x-staff-input"
              placeholder="例) 山田"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
            <label className="satisfaction-label" htmlFor="xMemo">
              投稿内容のメモ(任意)
            </label>
            <textarea
              id="xMemo"
              className="satisfaction-input"
              placeholder="例) 本日のおすすめ(厚切りタン)の写真を投稿"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <button
              className="next-guest-btn satisfaction-submit"
              type="button"
              disabled={saving}
              onClick={() => void markPosted(staffName, memo)}
            >
              {saving ? '保存中…' : '投稿した'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
