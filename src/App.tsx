import { useState } from 'react'
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
import { X } from 'lucide-react'

type Card = {
  id: string
  title: string
}

type Column = {
  id: string
  title: string
  cards: Card[]
}

// Upgraded themes for a more premium SaaS look
const BOARD_THEMES = [
  { id: 'midnight', label: 'Midnight', value: 'bg-slate-900' },
  { id: 'classic-blue', label: 'Blue', value: 'bg-blue-700' },
  { id: 'emerald', label: 'Emerald', value: 'bg-teal-800' },
  { id: 'purple', label: 'Purple', value: 'bg-indigo-950' },
  { id: 'sunset', label: 'Sunset', value: 'bg-gradient-to-br from-orange-500 to-rose-600' },
  { id: 'ocean', label: 'Ocean', value: 'bg-gradient-to-br from-cyan-700 to-blue-900' },
]

const initialColumns: Column[] = [
  {
    id: 'todo',
    title: 'To Do',
    cards: [
      { id: '1', title: 'Create project' },
      { id: '2', title: 'Build board UI' },
    ],
  },
  {
    id: 'doing',
    title: 'Doing',
    cards: [{ id: '3', title: 'Style with Tailwind' }],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [{ id: '4', title: 'Install dependencies' }],
  },
]

type TrelloCardProps = {
  card: Card
  columnId: string
  onDeleteCard: (columnId: string, cardId: string) => void
}

function TrelloCard({ card, columnId, onDeleteCard }: TrelloCardProps) {
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

  const showRedLabel = card.id.includes('1') || card.id.includes('4')
  const showBlueLabel = card.id.includes('2') || card.id.includes('3')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group flex cursor-grab flex-col gap-2 rounded-md bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-blue-400 ${
        isDragging ? 'opacity-40 shadow-2xl ring-2 ring-blue-500' : ''
      }`}
    >
      {/* Priority Labels */}
      <div className="flex gap-1">
        {showRedLabel && <div className="h-1.5 w-8 rounded-full bg-rose-500"></div>}
        {showBlueLabel && <div className="h-1.5 w-8 rounded-full bg-blue-500"></div>}
        {!showRedLabel && !showBlueLabel && <div className="h-1.5 w-8 rounded-full bg-emerald-500"></div>}
      </div>

      <div className="flex items-start justify-between">
        <span className="font-medium text-slate-700">{card.title}</span>
        <button
          onPointerDown={(e) => {
            e.stopPropagation()
            onDeleteCard(columnId, card.id)
          }}
          type="button"
          aria-label={`Delete ${card.title}`}
          className="rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card Metadata (Dates & Comments) */}
      <div className="mt-1 flex items-center gap-4 text-xs font-semibold text-slate-400">
        <span className="flex items-center gap-1.5 hover:text-slate-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Oct 24
        </span>
        <span className="flex items-center gap-1.5 hover:text-slate-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          2
        </span>
      </div>
    </div>
  )
}

type TrelloColumnProps = {
  column: Column
  newCardTitle: string
  onAddCard: (columnId: string) => void
  onDeleteCard: (columnId: string, cardId: string) => void
  onDeleteColumn: (columnId: string) => void
  onRenameColumn: (columnId: string, title: string) => void
  onUpdateNewCardTitle: (columnId: string, title: string) => void
}

function TrelloColumn({
  column,
  newCardTitle,
  onAddCard,
  onDeleteCard,
  onDeleteColumn,
  onRenameColumn,
  onUpdateNewCardTitle,
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
      className={`w-72 shrink-0 rounded-xl bg-slate-100 p-3 text-black shadow-sm ${
        isOver ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        {isEditingTitle ? (
          <input
            autoFocus
            value={column.title}
            onChange={(e) => onRenameColumn(column.id, e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
            className="min-w-0 flex-1 rounded-md bg-white px-2 py-1 font-semibold text-slate-800 outline-none ring-2 ring-blue-500"
          />
        ) : (
          <h2
            onClick={() => setIsEditingTitle(true)}
            className="flex-1 cursor-pointer truncate rounded-md px-2 py-1 font-semibold text-slate-800 hover:bg-slate-200/60"
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
        items={column.cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[10px]">
          {column.cards.map((card) => (
            <TrelloCard
              key={card.id}
              card={card}
              columnId={column.id}
              onDeleteCard={onDeleteCard}
            />
          ))}
        </div>
      </SortableContext>

      <div className="mt-3">
        {newCardTitle !== undefined && (
          <input
            value={newCardTitle}
            onChange={(e) => onUpdateNewCardTitle(column.id, e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-300 p-2 text-sm text-black outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="What needs to be done?"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddCard(column.id)
            }}
          />
        )}
        <button
          onClick={() => onAddCard(column.id)}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add a card
        </button>
      </div>
    </div>
  )
}

function App() {
  const [columns, setColumns] = useState(initialColumns)
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({})
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  
  const [theme, setTheme] = useState(BOARD_THEMES[0].value)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  function addCard(columnId: string) {
    const cardTitle = newCardTitles[columnId] || ''
    if (!cardTitle.trim()) return

    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cards: [
                ...column.cards,
                { id: crypto.randomUUID(), title: cardTitle },
              ],
            }
          : column,
      ),
    )
    setNewCardTitles((prevTitles) => ({ ...prevTitles, [columnId]: '' }))
  }

  function deleteCard(columnId: string, cardId: string) {
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId
          ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
          : column,
      ),
    )
  }

  function addColumn() {
    if (!newColumnTitle.trim()) return
    setColumns((prevColumns) => [
      ...prevColumns,
      { id: crypto.randomUUID(), title: newColumnTitle, cards: [] },
    ])
    setNewColumnTitle('')
  }

  function renameColumn(columnId: string, title: string) {
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId ? { ...column, title } : column,
      ),
    )
  }

  function deleteColumn(columnId: string) {
    setColumns((prevColumns) =>
      prevColumns.filter((column) => column.id !== columnId),
    )
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

      setColumns((prevColumns) =>
        prevColumns.map((column) => {
          if (column.id !== sourceColumnId) return column

          const oldIndex = column.cards.findIndex((card) => card.id === activeId)
          const newIndex = column.cards.findIndex((card) => card.id === overId)

          return {
            ...column,
            cards: arrayMove(column.cards, oldIndex, newIndex),
          }
        }),
      )
    } else {
      setColumns((prevColumns) => {
        const sourceColumn = prevColumns.find((col) => col.id === sourceColumnId)
        const targetColumn = prevColumns.find((col) => col.id === targetColumnId)

        if (!sourceColumn || !targetColumn) return prevColumns

        const movingCard = sourceColumn.cards.find((card) => card.id === activeId)
        if (!movingCard) return prevColumns

        const isOverACard = over.data.current?.columnId !== undefined
        let newIndex = targetColumn.cards.length

        if (isOverACard) {
          newIndex = targetColumn.cards.findIndex((card) => card.id === overId)
        }

        return prevColumns.map((column) => {
          if (column.id === sourceColumnId) {
            return {
              ...column,
              cards: column.cards.filter((card) => card.id !== activeId),
            }
          }

          if (column.id === targetColumnId) {
            const updatedCards = [...column.cards]
            updatedCards.splice(newIndex, 0, movingCard)
            return {
              ...column,
              cards: updatedCards,
            }
          }

          return column
        })
      })
    }
  }

  return (
    <div className={`min-h-screen text-white transition-colors duration-500 ${theme}`}>
      {/* Upgraded Glassmorphic Header */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-black/20 px-6 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500 text-white shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Project Alpha</h1>
        </div>
        
        {/* Theme Picker */}
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-white/70 sm:block">Theme</span>
          <div className="flex gap-2">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.value)}
                title={t.label}
                className={`h-5 w-5 rounded-full shadow-sm transition-transform hover:scale-125 ${
                  t.value
                } ${
                  theme === t.value
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent'
                    : 'border border-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-6">
            {columns.map((column) => (
              <TrelloColumn
                key={column.id}
                column={column}
                newCardTitle={newCardTitles[column.id] || ''}
                onAddCard={addCard}
                onDeleteCard={deleteCard}
                onDeleteColumn={deleteColumn}
                onRenameColumn={renameColumn}
                onUpdateNewCardTitle={updateNewCardTitle}
              />
            ))}

            <div className="w-72 shrink-0 rounded-xl bg-white/10 p-3 shadow-sm backdrop-blur-md transition-colors hover:bg-white/20">
              <input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/80 p-2.5 text-sm font-medium text-black outline-none placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-blue-400"
                placeholder="+ Add another list"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addColumn()
                  }
                }}
              />
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <TrelloCard
                card={activeCard}
                columnId="overlay"
                onDeleteCard={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  )
}

export default App
