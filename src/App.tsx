import { useState, useEffect } from 'react'
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, Moon, Sun } from 'lucide-react'

// --- NEW SUPABASE IMPORTS ---
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  fetchBoardData,
  dbAddColumn,
  dbAddCard,
  dbDeleteColumn,
  dbDeleteCard,
  dbRenameColumn,
  dbUpdateCardPosition,
  dbUpdateCardDetails,
} from './dbService'
// ----------------------------

type Card = {
  id: string
  title: string
  due_date?: string | null
  progress?: number
}

type Column = {
  id: string
  title: string
  cards: Card[]
}

type ActivityLog = {
  id: string
  action: string
  timestamp: Date
}

type TrelloCardProps = {
  card: Card
  columnId: string
  onDeleteCard: (columnId: string, cardId: string) => void
  onUpdateCardDetails: (cardId: string, updates: Partial<Card>) => void
}

function TrelloCard({ card, columnId, onDeleteCard, onUpdateCardDetails }: TrelloCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: {
        columnId,
      },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group flex cursor-grab flex-col gap-3 rounded-xl bg-white dark:bg-[#1E293B] p-4 text-sm shadow-sm ring-1 ring-slate-200 dark:ring-white/10 hover:ring-indigo-400 dark:hover:ring-indigo-500 transition-all duration-200 ${
        isDragging ? 'opacity-60 shadow-2xl ring-2 ring-indigo-500 scale-[1.02]' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{card.title}</span>
        <button
          onPointerDown={(e) => {
            e.stopPropagation()
            onDeleteCard(columnId, card.id)
          }}
          type="button"
          aria-label={`Delete ${card.title}`}
          className="rounded-md p-1.5 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress & Due Date */}
      <div className="mt-1 flex flex-col gap-3 border-t border-slate-100 dark:border-slate-700/50 pt-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <div 
            className="relative flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              const percent = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
              onUpdateCardDetails(card.id, { progress: percent })
            }}
          >
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                (card.progress || 0) >= 100 
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                  : (card.progress || 0) >= 50 
                    ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.3)]' 
                    : 'bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.3)]'
              }`}
              style={{ width: `${card.progress || 0}%` }} 
            />
          </div>
          <span className={`text-xs font-bold w-9 text-right ${
            (card.progress || 0) >= 100 ? 'text-emerald-500' : 'text-slate-500'
          }`}>{card.progress || 0}%</span>
        </div>
        
        {/* Due Date */}
        <div className="flex items-center text-xs font-semibold text-slate-400">
          <div className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input 
              type="date" 
              value={card.due_date || ''}
              onChange={(e) => onUpdateCardDetails(card.id, { due_date: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-transparent border-none outline-none text-slate-500 dark:text-slate-400 focus:ring-0 p-0 cursor-pointer flex-1 min-w-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

type TrelloColumnProps = {
  column: Column
  newCardTitle: string
  searchQuery: string
  onAddCard: (columnId: string) => void
  onDeleteCard: (columnId: string, cardId: string) => void
  onDeleteColumn: (columnId: string) => void
  onRenameColumn: (columnId: string, title: string) => void
  onUpdateNewCardTitle: (columnId: string, title: string) => void
  onUpdateCardDetails: (cardId: string, updates: Partial<Card>) => void
}

function TrelloColumn({
  column,
  newCardTitle,
  searchQuery,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onRenameColumn,
  onUpdateNewCardTitle,
  onUpdateCardDetails,
}: TrelloColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      columnId: column.id,
    },
  })

  const [isEditingTitle, setIsEditingTitle] = useState(false)

  return (
    <div
      ref={setNodeRef}
      className={`w-[320px] shrink-0 rounded-2xl bg-white/90 dark:bg-[#0F172A]/60 border border-gray-200 dark:border-gray-700 p-4 shadow-sm ring-1 ring-slate-200/60 dark:ring-white/10 backdrop-blur-xl flex flex-col transition-colors ${
        isOver ? 'ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-900/20' : ''
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2 px-1 pt-1">
        {isEditingTitle ? (
          <input
            autoFocus
            value={column.title}
            onChange={(e) => onRenameColumn(column.id, e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            className="min-w-0 flex-1 rounded-lg bg-white dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-800 dark:text-slate-100 outline-none ring-2 ring-indigo-500 shadow-inner"
          />
        ) : (
          <h2
            onClick={() => setIsEditingTitle(true)}
            className="flex-1 cursor-pointer truncate rounded-lg px-3 py-1.5 font-bold tracking-tight text-slate-800 dark:text-slate-100 transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            {column.title}
          </h2>
        )}

        <button
          onClick={() => onDeleteColumn(column.id)}
          type="button"
          aria-label={`Delete ${column.title}`}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <SortableContext
        items={column.cards
          .filter(c => !searchQuery || (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
          .map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[10px]">
          {column.cards
            .filter(c => !searchQuery || (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
            .map((card) => (
            <TrelloCard
              key={card.id}
              card={card}
              columnId={column.id}
              onDeleteCard={onDeleteCard}
              onUpdateCardDetails={onUpdateCardDetails}
            />
          ))}
        </div>
      </SortableContext>

      <div className="mt-4">
        {newCardTitle !== undefined && (
          <input
            value={newCardTitle}
            onChange={(e) => onUpdateNewCardTitle(column.id, e.target.value)}
            className="mb-3 w-full rounded-xl border border-transparent bg-white dark:bg-slate-800 p-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
            placeholder="What needs to be done?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddCard(column.id)
            }}
          />
        )}
        <button
          onClick={() => onAddCard(column.id)}
          className="group flex w-full items-center gap-2 rounded-xl p-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 hover:shadow-sm"
        >
          <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add a card
        </button>
      </div>
    </div>
  )
}

function App() {
  // --- SUPABASE STATE ---
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [boardLoading, setBoardLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [columns, setColumns] = useState<Column[]>([]) // Starts empty, loads from DB
  
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({})
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  function logActivity(action: string) {
    setActivityLogs(prev => [{ id: Math.random().toString(), action, timestamp: new Date() }, ...prev])
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  // --- SUPABASE DATA FETCHING ---
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      setBoardLoading(true)
      setErrorMessage('')
      fetchBoardData()
        .then((data) => setColumns(data))
        .catch((error) => {
          console.error(error)
          setErrorMessage(getErrorMessage(error))
        })
        .finally(() => {
          setBoardLoading(false)
        })
    } else {
      Promise.resolve().then(() => {
        setColumns([])
        setBoardLoading(false)
        setErrorMessage('')
      })
    }
  }, [session])

  async function refreshBoard() {
    try {
      setBoardLoading(true)
      setErrorMessage('')
      setColumns(await fetchBoardData())
    } catch (e) {
      console.error(e)
      setErrorMessage(getErrorMessage(e))
    } finally {
      setBoardLoading(false)
    }
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message

    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message)
    }

    return 'Something went wrong while talking to Supabase.'
  }

  function getOrderedCardsForMove(
    prevColumns: Column[],
    sourceColumnId: string,
    targetColumnId: string,
    activeId: string,
    overId: string,
  ) {
    if (sourceColumnId === targetColumnId) {
      const column = prevColumns.find((col) => col.id === sourceColumnId)
      if (!column) return null

      const oldIndex = column.cards.findIndex((card) => card.id === activeId)
      const newIndex = column.cards.findIndex((card) => card.id === overId)

      if (oldIndex === -1 || newIndex === -1) return null

      return arrayMove(column.cards, oldIndex, newIndex)
    }

    const sourceColumn = prevColumns.find((col) => col.id === sourceColumnId)
    const targetColumn = prevColumns.find((col) => col.id === targetColumnId)

    if (!sourceColumn || !targetColumn) return null

    const movingCard = sourceColumn.cards.find((card) => card.id === activeId)
    if (!movingCard) return null

    const newIndex =
      targetColumn.cards.findIndex((card) => card.id === overId)

    const updatedCards = [...targetColumn.cards]
    updatedCards.splice(newIndex === -1 ? targetColumn.cards.length : newIndex, 0, movingCard)

    return updatedCards
  }

  async function syncColumnCardPositions(columnId: string, cards: Card[]) {
    try {
      await Promise.all(
        cards.map((card, position) =>
          dbUpdateCardPosition(card.id, columnId, position),
        ),
      )
    } catch (e) {
      console.error(e)
      void refreshBoard()
    }
  }

  async function updateCardDetails(cardId: string, updates: Partial<Card>) {
    setColumns((prevColumns) =>
      prevColumns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c))
      }))
    )
    
    if (updates.progress !== undefined) {
      logActivity(`Updated progress to ${updates.progress}%`)
    } else if (updates.due_date !== undefined) {
      logActivity(`Set due date to ${updates.due_date || 'none'}`)
    }

    try {
      await dbUpdateCardDetails(cardId, updates)
    } catch(e) {
      console.error(e)
      setErrorMessage(getErrorMessage(e))
    }
  }

  async function addCard(columnId: string) {
    const cardTitle = newCardTitles[columnId] || ''
    if (!cardTitle.trim()) return

    setNewCardTitles((prevTitles) => ({ ...prevTitles, [columnId]: '' }))

    // 1. Add to Supabase
    const targetCol = columns.find(c => c.id === columnId)
    const position = targetCol ? targetCol.cards.length : 0
    try {
      const dbCard = await dbAddCard(cardTitle, columnId, position)
      
      // 2. Update your exact state logic with real ID
      setColumns((prevColumns) =>
        prevColumns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cards: [...column.cards, { id: dbCard.id, title: dbCard.title, progress: 0 }],
              }
            : column,
        ),
      )
      logActivity(`Added card "${dbCard.title}"`)
    } catch(e) {
      console.error(e)
      setErrorMessage(getErrorMessage(e))
    }
  }

  async function deleteCard(columnId: string, cardId: string) {
    const cardToDelete = columns.find(c => c.id === columnId)?.cards.find(c => c.id === cardId)
    if (cardToDelete) logActivity(`Deleted card "${cardToDelete.title}"`)

    // 1. Your exact optimistic update
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId
          ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
          : column,
      ),
    )
    // 2. Delete from DB
    await dbDeleteCard(cardId).catch((error) => {
      console.error(error)
      setErrorMessage(getErrorMessage(error))
      void refreshBoard()
    })
  }

  async function addColumn() {
    if (!newColumnTitle.trim()) return
    const title = newColumnTitle
    setNewColumnTitle('')

    try {
      // 1. Add to Supabase
      const dbCol = await dbAddColumn(title, columns.length)
      
      // 2. Your exact optimistic update
      setColumns((prevColumns) => [
        ...prevColumns,
        { id: dbCol.id, title: dbCol.title, cards: [] },
      ])
    } catch(e) {
      console.error(e)
      setErrorMessage(getErrorMessage(e))
    }
  }

  async function renameColumn(columnId: string, title: string) {
    // 1. Your exact optimistic update
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId ? { ...column, title } : column,
      ),
    )
    // 2. Rename in DB
    await dbRenameColumn(columnId, title).catch((error) => {
      console.error(error)
      setErrorMessage(getErrorMessage(error))
      void refreshBoard()
    })
  }

  async function deleteColumn(columnId: string) {
    // 1. Your exact optimistic update
    setColumns((prevColumns) =>
      prevColumns.filter((column) => column.id !== columnId),
    )
    // 2. Delete from DB
    await dbDeleteColumn(columnId).catch((error) => {
      console.error(error)
      setErrorMessage(getErrorMessage(error))
      void refreshBoard()
    })
  }

  function updateNewCardTitle(columnId: string, title: string) {
    setNewCardTitles((prevTitles) => ({ ...prevTitles, [columnId]: title }))
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const activeId = String(active.id)
    const sourceColumnId = active.data.current?.columnId as string | undefined

    if (!sourceColumnId) return

    const sourceColumn = columns.find((col) => col.id === sourceColumnId)
    const card = sourceColumn?.cards.find((c) => c.id === activeId)

    if (card) setActiveCard(card)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)

    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const sourceColumnId = active.data.current?.columnId as string | undefined
    const targetColumnId =
      (over.data.current?.columnId as string | undefined) || overId

    if (!sourceColumnId || !targetColumnId) return

    if (sourceColumnId === targetColumnId) {
      if (activeId === overId) return

      const orderedCards = getOrderedCardsForMove(
        columns,
        sourceColumnId,
        targetColumnId,
        activeId,
        overId,
      )

      if (!orderedCards) return

      logActivity(`Reordered cards in column`)

      setColumns((prevColumns) =>
        prevColumns.map((column) =>
          column.id === sourceColumnId
            ? { ...column, cards: orderedCards }
            : column,
        ),
      )

      void syncColumnCardPositions(sourceColumnId, orderedCards)
      return
    }

    const targetCards = getOrderedCardsForMove(
      columns,
      sourceColumnId,
      targetColumnId,
      activeId,
      overId,
    )
    const sourceColumn = columns.find((col) => col.id === sourceColumnId)

    if (!targetCards || !sourceColumn) return

    const sourceCards = sourceColumn.cards.filter((card) => card.id !== activeId)

    setColumns((prevColumns) =>
      prevColumns.map((column) => {
        if (column.id === sourceColumnId) return { ...column, cards: sourceCards }
        if (column.id === targetColumnId) return { ...column, cards: targetCards }

        return column
      }),
    )

    const movingCard = sourceColumn.cards.find((card) => card.id === activeId)
    if (movingCard) {
      logActivity(`Moved card "${movingCard.title}"`)
    }

    void syncColumnCardPositions(sourceColumnId, sourceCards)
    void syncColumnCardPositions(targetColumnId, targetCards)
  }

  // --- SUPABASE GATEKEEPERS ---
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-slate-400 text-sm">Connecting...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
          <h1 className="mb-6 text-center text-3xl font-bold text-slate-800">Kanban Board</h1>
          <p className="mb-8 text-center text-sm text-slate-500">Sign in to access your board</p>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen font-sans transition-colors duration-700 ${isDarkMode ? 'dark bg-[#020617] text-slate-300' : 'bg-slate-50 text-slate-800'} relative overflow-hidden`}>
      {/* Premium Decorative Background Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -left-1/4 -top-1/4 h-[800px] w-[800px] rounded-full blur-[120px] transition-colors duration-700 ${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-300/30'}`} />
        <div className={`absolute -right-1/4 top-1/4 h-[600px] w-[600px] rounded-full blur-[100px] transition-colors duration-700 ${isDarkMode ? 'bg-emerald-900/20' : 'bg-sky-200/40'}`} />
        <div className={`absolute left-1/3 bottom-0 h-[500px] w-[500px] rounded-full blur-[100px] transition-colors duration-700 ${isDarkMode ? 'bg-purple-900/20' : 'bg-purple-200/30'}`} />
      </div>

      <div className="relative z-10 flex h-screen flex-col">
        {/* Upgraded Glassmorphic Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/60 dark:border-white/5 bg-white/60 dark:bg-[#020617]/60 px-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                Kanban Board
              </h1>
            </div>

            {/* Search Bar */}
            <div className="relative hidden md:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search board..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-64 rounded-full border-none bg-slate-100/80 dark:bg-slate-800/50 py-1.5 pl-10 pr-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner transition-all"
              />
            </div>
          </div>
          
          {/* Theme Picker & Logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              className="rounded-full p-2 text-slate-500 transition-all hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              title="Activity History"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1"></div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-full p-2 text-slate-500 transition-all hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            <button 
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg bg-rose-500/10 dark:bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-600 dark:text-rose-400 transition-all hover:bg-rose-500/20 dark:hover:bg-rose-500/30 active:scale-95"
            >
              Sign Out
            </button>
          </div>
        </header>

      <main className="flex-1 overflow-x-auto overflow-y-auto p-6">
        {errorMessage && (
          <div className="mb-4 max-w-3xl rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
            {errorMessage}
          </div>
        )}

        {boardLoading && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            Loading board
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-6">
            {columns
              .filter((column) => !searchQuery || 
                column.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                column.cards.some(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((column) => (
              <TrelloColumn
                key={column.id}
                column={column}
                newCardTitle={newCardTitles[column.id] || ''}
                searchQuery={searchQuery}
                onAddCard={addCard}
                onDeleteCard={deleteCard}
                onDeleteColumn={deleteColumn}
                onRenameColumn={renameColumn}
                onUpdateNewCardTitle={updateNewCardTitle}
                onUpdateCardDetails={updateCardDetails}
              />
            ))}

            {/* No results message */}
            {searchQuery && !columns.some(col => 
              col.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              col.cards.some(c => (c.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
            ) && (
              <div className="flex flex-col items-center justify-center w-full py-20 text-center">
                <svg className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">No results found for "{searchQuery}"</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try a different search term</p>
              </div>
            )}

            {!searchQuery && (
            <div className="w-[320px] shrink-0 rounded-2xl bg-white/30 dark:bg-white/5 p-4 shadow-sm ring-1 ring-slate-200/50 dark:ring-white/5 backdrop-blur-xl transition-all hover:bg-white/50 dark:hover:bg-white/10">
              <input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 p-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 shadow-inner transition-all"
                placeholder="+ Add another list"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addColumn()
                  }
                }}
              />
            </div>
            )}
          </div>

          <DragOverlay>
            {activeCard ? (
              <TrelloCard
                card={activeCard}
                columnId="overlay"
                onDeleteCard={() => {}}
                onUpdateCardDetails={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Activity History Panel */}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 transform bg-white dark:bg-[#0F172A] shadow-2xl transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Activity</h2>
          <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100vh-4rem)] space-y-5">
          {activityLogs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10">No recent activity.</p>
          ) : (
            activityLogs.map(log => (
              <div key={log.id} className="flex gap-4 text-sm">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/20" />
                </div>
                <div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium leading-tight">{log.action}</p>
                  <p className="text-xs text-slate-400 mt-1">{log.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      </div>
    </div>
  )
}

export default App
