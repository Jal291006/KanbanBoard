import { useState } from 'react'
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

type Card = {
  id: string
  title: string
}

type Column = {
  id: string
  title: string
  cards: Card[]
}

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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
      data: {
        columnId,
      },
    })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-start justify-between gap-2 rounded-md bg-white p-3 text-sm shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <span>{card.title}</span>

      <button
        onClick={() => onDeleteCard(columnId, card.id)}
        className="rounded px-2 text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
      >
        x
      </button>
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

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-md bg-neutral-100 p-3 text-black ${
        isOver ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          value={column.title}
          onChange={(e) => onRenameColumn(column.id, e.target.value)}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={() => onDeleteColumn(column.id)}
          className="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-500"
        >
          x
        </button>
      </div>

      <div className="space-y-2">
        {column.cards.map((card) => (
          <TrelloCard
            key={card.id}
            card={card}
            columnId={column.id}
            onDeleteCard={onDeleteCard}
          />
        ))}
      </div>

      <input
        value={newCardTitle}
        onChange={(e) => onUpdateNewCardTitle(column.id, e.target.value)}
        className="mt-3 w-full rounded-md border border-neutral-300 p-2 text-sm text-black outline-none focus:border-blue-500"
        placeholder="Add a card"
      />

      <button
        onClick={() => onAddCard(column.id)}
        className="mt-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add Card
      </button>
    </div>
  )
}

function App() {
  const [columns, setColumns] = useState(initialColumns)
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({})
  const [newColumnTitle, setNewColumnTitle] = useState('')

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
                {
                  id: crypto.randomUUID(),
                  title: cardTitle,
                },
              ],
            }
          : column,
      ),
    )

    setNewCardTitles((prevTitles) => ({
      ...prevTitles,
      [columnId]: '',
    }))
  }

  function deleteCard(columnId: string, cardId: string) {
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cards: column.cards.filter((card) => card.id !== cardId),
            }
          : column,
      ),
    )
  }

  function addColumn() {
    if (!newColumnTitle.trim()) return

    setColumns((prevColumns) => [
      ...prevColumns,
      {
        id: crypto.randomUUID(),
        title: newColumnTitle,
        cards: [],
      },
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
    setNewCardTitles((prevTitles) => ({
      ...prevTitles,
      [columnId]: title,
    }))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) return

    const activeCardId = String(active.id)
    const sourceColumnId = active.data.current?.columnId as string | undefined
    const targetColumnId = over.data.current?.columnId as string | undefined

    if (!sourceColumnId || !targetColumnId || sourceColumnId === targetColumnId) {
      return
    }

    setColumns((prevColumns) => {
      const sourceColumn = prevColumns.find(
        (column) => column.id === sourceColumnId,
      )
      const movingCard = sourceColumn?.cards.find(
        (card) => card.id === activeCardId,
      )

      if (!movingCard) return prevColumns

      return prevColumns.map((column) => {
        if (column.id === sourceColumnId) {
          return {
            ...column,
            cards: column.cards.filter((card) => card.id !== activeCardId),
          }
        }

        if (column.id === targetColumnId) {
          return {
            ...column,
            cards: [...column.cards, movingCard],
          }
        }

        return column
      })
    })
  }

  return (
    <div className="min-h-screen bg-sky-700 text-white">
      <header className="flex h-14 items-center border-b border-white/20 px-4">
        <h1 className="text-lg font-bold">Trello Clone</h1>
      </header>

      <main className="overflow-x-auto p-4">
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex items-start gap-4">
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

            <div className="w-72 shrink-0 rounded-md bg-white/20 p-3">
              <input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                className="w-full rounded-md border border-white/30 bg-white/90 p-2 text-sm text-black outline-none focus:border-blue-500"
                placeholder="Add another list"
              />

              <button
                onClick={addColumn}
                className="mt-2 w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-neutral-100"
              >
                Add List
              </button>
            </div>
          </div>
        </DndContext>
      </main>
    </div>
  )
}

export default App
