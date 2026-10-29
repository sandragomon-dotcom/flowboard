import { supabase } from './supabase'
import { PRIORITIES, type CardData, type CardInput, type ColumnData, type Priority, type Status } from './types'

export interface CardRow {
  id: string
  title: string
  assignee: string
  priority: string
  due_date: string | null
  status: string
  position: number
}

export function rowToCard(row: CardRow): CardData {
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    priority: PRIORITIES.find((p) => p === row.priority) ?? ('Medium' as Priority),
    dueDate: row.due_date ?? '',
    status: row.status,
    position: row.position,
  }
}

const COLUMNS_SQL = 'id, title, assignee, priority, due_date, status, position'

export async function fetchCards(): Promise<CardData[]> {
  const { data, error } = await supabase.from('cards').select(COLUMNS_SQL).order('position')
  if (error) throw error
  return (data as CardRow[]).map(rowToCard)
}

export async function insertCard(input: CardInput, status: Status, position: number): Promise<CardData> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      title: input.title,
      assignee: input.assignee,
      priority: input.priority,
      due_date: input.dueDate || null,
      status,
      position,
    })
    .select(COLUMNS_SQL)
    .single()
  if (error) throw error
  return rowToCard(data as CardRow)
}

export async function updateCardFields(id: string, input: CardInput): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({
      title: input.title,
      assignee: input.assignee,
      priority: input.priority,
      due_date: input.dueDate || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function updateCardPlacement(id: string, status: Status, position: number): Promise<void> {
  const { error } = await supabase.from('cards').update({ status, position }).eq('id', id)
  if (error) throw error
}

export async function deleteCardsByStatus(status: Status): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('status', status)
  if (error) throw error
}

export async function deleteCardById(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

export interface ColumnRow {
  id: string
  name: string
  position: number
}

export const rowToColumn = (row: ColumnRow): ColumnData => ({ id: row.id, name: row.name, position: row.position })

export async function fetchColumns(): Promise<ColumnData[]> {
  const { data, error } = await supabase.from('columns').select('id, name, position').order('position')
  if (error) throw error
  return (data as ColumnRow[]).map(rowToColumn)
}

export async function insertColumn(name: string, position: number): Promise<ColumnData> {
  const { data, error } = await supabase.from('columns').insert({ name, position }).select('id, name, position').single()
  if (error) throw error
  return rowToColumn(data as ColumnRow)
}

export async function renameColumn(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('columns').update({ name }).eq('id', id)
  if (error) throw error
}

// Cards must go first: cards.status references columns.id with ON DELETE RESTRICT.
export async function deleteColumnById(id: string): Promise<void> {
  await deleteCardsByStatus(id)
  const { error } = await supabase.from('columns').delete().eq('id', id)
  if (error) throw error
}
