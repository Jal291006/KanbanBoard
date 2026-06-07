import { supabase } from './supabase'

// 1. Fetch all columns and cards from the database
export async function fetchBoardData() {
  // Grab columns ordered by their position
  const { data: dbColumns, error: colError } = await supabase
    .from('columns')
    .select('*')
    .order('position', { ascending: true })

  if (colError) throw colError

  // Grab cards ordered by their position
  const { data: dbCards, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .order('position', { ascending: true })

  if (cardError) throw cardError

  // Format the flat SQL rows back into our structured Column state array
 // Format the flat SQL rows back into our structured Column state array
  return (dbColumns || []).map((col: any) => ({
    id: col.id,
    title: col.title,
    cards: (dbCards || [])
      .filter((card: any) => card.column_id === col.id)
      .map((card: any) => ({ 
        id: card.id, 
        title: card.title,
        due_date: card.due_date,
        progress: card.progress || 0
      })),
  }))
}

// 2. Add a new column to the database
export async function dbAddColumn(title: string, position: number) {
  const { data, error } = await supabase
    .from('columns')
    .insert([{ title, position }])
    .select()
    .single()

  if (error) throw error
  return data
}

// 3. Add a new card to a column
export async function dbAddCard(title: string, columnId: string, position: number) {
  const { data, error } = await supabase
    .from('cards')
    .insert([{ title, column_id: columnId, position }])
    .select()
    .single()

  if (error) throw error
  return data
}

// 4. Delete a column (and everything inside it automatically via CASCADE)
export async function dbDeleteColumn(columnId: string) {
  const { error } = await supabase.from('columns').delete().eq('id', columnId)
  if (error) throw error
}

// 5. Delete a single card
export async function dbDeleteCard(cardId: string) {
  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw error
}

// 6. Rename a column title
export async function dbRenameColumn(columnId: string, title: string) {
  const { error } = await supabase
    .from('columns')
    .update({ title })
    .eq('id', columnId)
  if (error) throw error
}

// 7. Update card positioning when dropped
export async function dbUpdateCardPosition(cardId: string, targetColumnId: string, position: number) {
  const { error } = await supabase
    .from('cards')
    .update({ column_id: targetColumnId, position })
    .eq('id', cardId)
  if (error) throw error
}

export async function dbUpdateCardDetails(
  cardId: string, 
  updates: { title?: string; due_date?: string | null; progress?: number }
) {
  const { error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', cardId)
  if (error) throw error
}