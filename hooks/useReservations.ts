'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Reservation } from '@/lib/supabase'
import { fitsInDay, overlaps } from '@/lib/reservations'

export type ReservationDraft = {
  seat: string
  start_slot: number
  duration_slots: number
  name: string
  party_size: string
  note: string
  is_walk_in: boolean
}

export type SaveResult = { ok: true } | { ok: false; error: string }

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

  /** 同じ席で時間が重なる予約。自分自身は除く。 */
  const findConflict = useCallback(
    (seat: string, startSlot: number, durationSlots: number, ignoreId?: number): Reservation | null => {
      const candidate = { start_slot: startSlot, duration_slots: durationSlots }
      return (
        reservations.find((r) => r.seat === seat && r.id !== ignoreId && overlaps(r, candidate)) ?? null
      )
    },
    [reservations],
  )

  const validate = useCallback(
    (seat: string, startSlot: number, durationSlots: number, ignoreId?: number): string | null => {
      if (!fitsInDay(startSlot, durationSlots)) return '営業時間(17:00〜26:00)からはみ出します。'
      const conflict = findConflict(seat, startSlot, durationSlots, ignoreId)
      if (conflict) return `${seat}のその時間には${conflict.name ?? '別の予約'}さんが入っています。`
      return null
    },
    [findConflict],
  )

  const createReservation = useCallback(
    async (draft: ReservationDraft): Promise<SaveResult> => {
      const error = validate(draft.seat, draft.start_slot, draft.duration_slots)
      if (error) return { ok: false, error }
      setSaving(true)
      try {
        const size = Number(draft.party_size)
        const { error: dbError } = await supabase.from('reservations').insert({
          reserve_date: dateKey,
          seat: draft.seat,
          start_slot: draft.start_slot,
          duration_slots: draft.duration_slots,
          name: draft.name.trim() || null,
          party_size: Number.isFinite(size) && size > 0 ? size : null,
          note: draft.note.trim() || null,
          is_walk_in: draft.is_walk_in,
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
      const seat = patch.seat ?? current.seat
      const start = patch.start_slot ?? current.start_slot
      const duration = patch.duration_slots ?? current.duration_slots
      const error = validate(seat, start, duration, id)
      if (error) return { ok: false, error }

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

  /** 前後に15分ずらす。席の準備で少しずらすときに使う。 */
  const nudge = useCallback(
    async (id: number, deltaSlots: number): Promise<SaveResult> => {
      const current = reservations.find((r) => r.id === id)
      if (!current) return { ok: false, error: '予約が見つかりません。' }
      return updateReservation(id, { start_slot: current.start_slot + deltaSlots })
    },
    [reservations, updateReservation],
  )

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
    const booked = reservations.filter((r) => !r.is_walk_in).length
    const walkIn = reservations.filter((r) => r.is_walk_in).length
    const guests = reservations.reduce((sum, r) => sum + (r.party_size ?? 0), 0)
    return { booked, walkIn, total: reservations.length, guests }
  }, [reservations])

  return {
    loading,
    saving,
    reservations,
    stats,
    validate,
    createReservation,
    updateReservation,
    nudge,
    deleteReservation,
  }
}
