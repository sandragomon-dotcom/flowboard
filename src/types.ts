export type Status = string
export type Priority = 'High' | 'Medium' | 'Low'

export interface CardData {
  id: string
  title: string
  assignee: string
  priority: Priority
  dueDate: string
  status: Status
  position: number
}

export type CardInput = Omit<CardData, 'id' | 'status' | 'position'>

export interface ColumnData {
  id: Status
  name: string
  position: number
}

// Id of the built-in column that "Clear completed" and overdue highlighting treat as finished.
export const DONE_ID = 'done'

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']

export type ShiftDirection = 'left' | 'right' | 'up' | 'down'
