'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/lib/supabase'
import {
  countsAsGuest,
  fitsInDay,
  freeSeatsByHour,
  holdsSeat,
  overlaps,
  seatsLabel,
  sortSeats,
  type ReservationStatus,
} from '@/lib/reservations'

export type ReservationDraft = {
  seats: string[]
  start_slot: number
  duration_slots: number
  name: string
  party_size: string
  child_size: string
  phone: string
  course: string
  note: string
  source: string
  is_walk_in: boolean
}

export type SaveResult = { ok: true } | { ok: false; error: string }

function toCount(value: string): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function useReservations(dateKey: string) {
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('reserve_date', dateKey)
      .order('start_slot')
    setReservations((data ?? []) as Reservation[])
  }, [dateKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      if (!cancelled) setLoadedDate(dateKey)
    })()
    return () => {
      cancelled = true
    }
  }, [reload, dateKey])

  // 予約は複数人が別々の端末から入れるので、他端末の変更もすぐ映るようにする。
  useEffect(() => {
    const channel = supabase
      .channel(`reservations-${dateKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => void reload())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateKey, reload])

  const loading = loadedDate !== dateKey

  /** 卓と時間が重なる予約。自分自身と、席を空けている予約は除く。 */
  const findConflict = useCallback(
    (seats: string[], startSlot: number, durationSlots: number, ignoreId?: number): Reservation | null => {
      const candidate = { start_slot: startSlot, duration_slots: durationSlots }
      return (
        reservations.find(
          (r) =>
            r.id !== ignoreId &&
            holdsSeat(r.status) &&
            overlaps(r, candidate) &&
            r.seats.some((s) => seats.includes(s)),
        ) ?? null
      )
    },
    [reservations],
  )

  const validate = useCallback(
    (seats: string[], startSlot: number, durationSlots: number, ignoreId?: number): string | null => {
      if (seats.length === 0) return '卓を1つ以上選んでください。'
      if (!fitsInDay(startSlot, durationSlots)) return '営業時間(17:00〜26:00)からはみ出します。'
      const conflict = findConflict(seats, startSlot, durationSlots, ignoreId)
      if (conflict) {
        const shared = conflict.seats.filter((s) => seats.includes(s))
        return `${seatsLabel(shared)}のその時間には${conflict.name ?? '別の予約'}さんが入っています。`
      }
      return null
    },
    [findConflict],
  )

  const createReservation = useCallback(
    async (draft: ReservationDraft): Promise<SaveResult> => {
      const seats = sortSeats(draft.seats)
      const error = validate(seats, draft.start_slot, draft.duration_slots)
      if (error) return { ok: false, error }
      setSaving(true)
      try {
        const { error: dbError } = await supabase.from('reservations').insert({
          reserve_date: dateKey,
          seats,
          start_slot: draft.start_slot,
          duration_slots: draft.duration_slots,
          name: draft.name.trim() || null,
          party_size: toCount(draft.party_size),
          child_size: toCount(draft.child_size),
          phone: draft.phone.trim() || null,
          course: draft.course.trim() || null,
          note: draft.note.trim() || null,
          source: draft.source || null,
          is_walk_in: draft.is_walk_in,
          // 飛び込みのお客様は、入れた時点でもう座っている。
          status: draft.is_walk_in ? 'seated' : 'booked',
          seated_at: draft.is_walk_in ? new Date().toISOString() : null,
        })
        if (dbError) {
          console.error('createReservation failed', dbError)
          return { ok: false, error: `保存できませんでした(${dbError.message})` }
        }
        await reload()
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [dateKey, validate, reload],
  )

  const updateReservation = useCallback(
    async (id: number, patch: Partial<Reservation>): Promise<SaveResult> => {
      const current = reservations.find((r) => r.id === id)
      if (!current) return { ok: false, error: '予約が見つかりません。' }
      const seats = patch.seats ? sortSeats(patch.seats) : current.seats
      const start = patch.start_slot ?? current.start_slot
      const duration = patch.duration_slots ?? current.duration_slots
      const status = patch.status ?? current.status

      // 席を空ける状態(キャンセル等)へ移すときは、重なりを見る必要がない。
      if (holdsSeat(status)) {
        const error = validate(seats, start, duration, id)
        if (error) return { ok: false, error }
      }

      setSaving(true)
      try {
        // 画面が固まらないよう、先に手元を書き換えてから保存する。
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
        const { error: dbError } = await supabase.from('reservations').update(patch).eq('id', id)
        if (dbError) {
          console.error('updateReservation failed', dbError)
          await reload()
          return { ok: false, error: `保存できませんでした(${dbError.message})` }
        }
        await reload()
        return { ok: true }
      } finally {
        setSaving(false)
      }
    },
    [reservations, validate, reload],
  )

  /** 来店・退店・キャンセルの切り替え。時刻も一緒に残す。 */
  const setStatus = useCallback(
    async (id: number, status: ReservationStatus): Promise<SaveResult> => {
      const now = new Date().toISOString()
      const patch: Partial<Reservation> = { status }
      if (status === 'seated') {
        patch.seated_at = now
        patch.left_at = null
      } else if (status === 'done') {
        patch.left_at = now
      } else if (status === 'booked') {
        patch.seated_at = null
        patch.left_at = null
      }
      return updateReservation(id, patch)
    },
    [updateReservation],
  )

  /** 前後に15分ずらす。席の準備で少しずらすときに使う。 */
  const nudge = useCallback(
    async (id: number, deltaSlots: number): Promise<SaveResult> => {
      const current = reservations.find((r) => r.id === id)
      if (!current) return { ok: false, error: '予約が見つかりません。' }
      return updateReservation(id, { start_slot: current.start_slot + deltaSlots })
    },
    [reservations, updateReservation],
  )

  /** 入力そのものが間違いだったとき用。お客様都合の取り消しはキャンセル状態を使う。 */
  const deleteReservation = useCallback(
    async (id: number) => {
      setSaving(true)
      try {
        setReservations((prev) => prev.filter((r) => r.id !== id))
        await supabase.from('reservations').delete().eq('id', id)
        await reload()
      } finally {
        setSaving(false)
      }
    },
    [reload],
  )

  const stats = useMemo(() => {
    const live = reservations.filter((r) => countsAsGuest(r.status))
    const booked = live.filter((r) => !r.is_walk_in).length
    const walkIn = live.filter((r) => r.is_walk_in).length
    const guests = live.reduce((sum, r) => sum + (r.party_size ?? 0), 0)
    const children = live.reduce((sum, r) => sum + (r.child_size ?? 0), 0)
    const seated = live.filter((r) => r.status === 'seated').length
    const cancelled = reservations.filter((r) => r.status === 'cancelled').length
    const noshow = reservations.filter((r) => r.status === 'noshow').length
    return { booked, walkIn, total: live.length, guests, children, seated, cancelled, noshow }
  }, [reservations])

  const freeByHour = useMemo(() => freeSeatsByHour(reservations), [reservations])

  return {
    loading,
    saving,
    reservations,
    stats,
    freeByHour,
    validate,
    createReservation,
    updateReservation,
    setStatus,
    nudge,
    deleteReservation,
  }
}
