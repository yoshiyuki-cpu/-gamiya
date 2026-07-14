'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { WallMenuItem, WallOrder } from '@/lib/supabase'

const STAFF_STORAGE_KEY = 'gamiya:current-staff'

export function useWallOrders() {
  const [loading, setLoading] = useState(true)
  const [menuItems, setMenuItems] = useState<WallMenuItem[]>([])
  const [orders, setOrders] = useState<WallOrder[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [currentStaff, setCurrentStaffState] = useState('')
  const [editMode, setEditMode] = useState(false)

  const currentStaffRef = useRef(currentStaff)
  useEffect(() => {
    currentStaffRef.current = currentStaff
  }, [currentStaff])

  const applyMenuItem = useCallback((row: WallMenuItem) => {
    setMenuItems((prev) => {
      const idx = prev.findIndex((m) => m.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((m) => (m.id === row.id ? row : m))
      return next.slice().sort((a, b) => a.sort_order - b.sort_order)
    })
  }, [])

  const applyOrder = useCallback((row: WallOrder) => {
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((o) => (o.id === row.id ? row : o))
      return next.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id))
    })
  }, [])

  // ---- initial load: menu items + pending orders + staff list (once) ----

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: menuData }, { data: orderData }, { data: staffData }] = await Promise.all([
        supabase.from('wall_menu_items').select('*').order('sort_order'),
        supabase.from('wall_orders').select('*').is('completed_at', null).order('created_at'),
        supabase.from('staff_names').select('*').order('name'),
      ])
      if (cancelled) return
      setMenuItems(menuData ?? [])
      setOrders(orderData ?? [])
      setStaffList((staffData ?? []).map((s) => s.name))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- current staff: device-local, persisted to localStorage (shared with checklist page) ----

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STAFF_STORAGE_KEY)
      // One-time hydration from a per-device external store on mount, not a
      // subscription — safe despite the generic set-state-in-effect lint rule.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setCurrentStaffState(saved)
    } catch {
      // ignore
    }
  }, [])

  const setCurrentStaff = useCallback((name: string) => {
    setCurrentStaffState(name)
    try {
      window.localStorage.setItem(STAFF_STORAGE_KEY, name)
    } catch {
      // ignore
    }
  }, [])

  const commitCurrentStaff = useCallback(async () => {
    const trimmed = currentStaffRef.current.trim()
    if (!trimmed) return
    setStaffList((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed].sort()))
    await supabase.from('staff_names').upsert({ name: trimmed }, { onConflict: 'name', ignoreDuplicates: true })
  }, [])

  // ---- realtime: menu items, orders, staff names ----

  useEffect(() => {
    const menuChannel = supabase
      .channel('wall-menu-items-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wall_menu_items' },
        (payload: RealtimePostgresChangesPayload<WallMenuItem>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            applyMenuItem(payload.new as WallMenuItem)
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<WallMenuItem>).id
            if (oldId != null) setMenuItems((prev) => prev.filter((m) => m.id !== oldId))
          }
        },
      )
      .subscribe()

    const ordersChannel = supabase
      .channel('wall-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wall_orders' },
        (payload: RealtimePostgresChangesPayload<WallOrder>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as WallOrder
            if (row.completed_at) {
              setOrders((prev) => prev.filter((o) => o.id !== row.id))
            } else {
              applyOrder(row)
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<WallOrder>).id
            if (oldId != null) setOrders((prev) => prev.filter((o) => o.id !== oldId))
          }
        },
      )
      .subscribe()

    const staffChannel = supabase
      .channel('wall-orders-staff-names-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staff_names' },
        (payload: RealtimePostgresChangesPayload<{ name: string }>) => {
          const name = (payload.new as { name?: string }).name
          if (name) setStaffList((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(menuChannel)
      supabase.removeChannel(ordersChannel)
      supabase.removeChannel(staffChannel)
    }
  }, [applyMenuItem, applyOrder])

  // ---- menu items ----

  const addMenuItem = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed || menuItems.some((m) => m.name === trimmed)) return
      const nextSortOrder = menuItems.length ? Math.max(...menuItems.map((m) => m.sort_order)) + 1 : 1
      const { data, error } = await supabase
        .from('wall_menu_items')
        .insert({ name: trimmed, sort_order: nextSortOrder })
        .select()
        .single()
      if (!error && data) applyMenuItem(data as WallMenuItem)
    },
    [menuItems, applyMenuItem],
  )

  const deleteMenuItem = useCallback(async (id: number, name: string) => {
    const ok = window.confirm(`「${name}」をメニュー一覧から削除します。よろしいですか?`)
    if (!ok) return
    setMenuItems((prev) => prev.filter((m) => m.id !== id))
    await supabase.from('wall_menu_items').delete().eq('id', id)
  }, [])

  // ---- orders ----

  const addOrder = useCallback(
    async (tableNumber: string, itemName: string, quantity: number) => {
      const trimmedTable = tableNumber.trim()
      const trimmedItem = itemName.trim()
      if (!trimmedTable || !trimmedItem || quantity < 1) return
      const staffName = currentStaffRef.current.trim() || null

      // A menu name typed on the fly (not yet in the registered list) joins it too.
      void addMenuItem(trimmedItem)

      const { data, error } = await supabase
        .from('wall_orders')
        .insert({ table_number: trimmedTable, item_name: trimmedItem, quantity, staff_name: staffName })
        .select()
        .single()
      if (!error && data) applyOrder(data as WallOrder)
    },
    [addMenuItem, applyOrder],
  )

  const completeOrder = useCallback(async (orderId: number) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    await supabase.from('wall_orders').update({ completed_at: new Date().toISOString() }).eq('id', orderId)
  }, [])

  return {
    loading,
    menuItems,
    orders,
    staffList,
    currentStaff,
    setCurrentStaff,
    commitCurrentStaff,
    editMode,
    setEditMode,
    addMenuItem,
    deleteMenuItem,
    addOrder,
    completeOrder,
  }
}
