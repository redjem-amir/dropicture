// dropicture/app/frontend/src/app/auth/trash/page.tsx
import { TbArrowBackUp, TbTrash } from 'react-icons/tb'

const GRADIENTS = [
    'from-amber-200 to-orange-300',
    'from-sky-200 to-indigo-300',
    'from-rose-200 to-pink-300',
    'from-emerald-200 to-teal-300',
    'from-violet-200 to-fuchsia-300',
    'from-cyan-200 to-blue-300',
    'from-lime-200 to-emerald-300',
    'from-stone-200 to-stone-400',
    'from-orange-200 to-rose-300',
    'from-indigo-200 to-violet-300',
]

type Trashed = { id: string; gradient: string; daysLeft: number }
const TRASH: Trashed[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    gradient: GRADIENTS[i % GRADIENTS.length],
    daysLeft: 30 - i * 3,
}))

const BTN_DANGER_OUTLINE =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-red-600 shadow-sm transition-colors hover:border-red-300 hover:text-red-700'

export default function TrashPage() {
    const items = TRASH

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Trash</h1>
                    <p className="mt-1 text-sm text-stone-500">{items.length} items</p>
                </div>
                {items.length > 0 && (
                    <button className={BTN_DANGER_OUTLINE}>
                        <TbTrash className="size-4" />
                        Empty trash
                    </button>
                )}
            </div>

            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm">
                        <TbTrash className="size-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-stone-900">Trash is empty</h3>
                    <p className="mt-1 max-w-sm text-sm text-stone-500">
                        Deleted photos rest here for 30 days, so you can always change your mind.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-start gap-2 rounded-xl border border-stone-200/70 bg-stone-50/60 px-4 py-3 text-sm text-stone-500">
                        <TbTrash className="mt-0.5 size-4 shrink-0 text-stone-400" />
                        <p>Items in trash are permanently deleted after 30 days. Restore anything before then to keep it.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                        {items.map(item => {
                            const urgent = item.daysLeft <= 7
                            return (
                                <div key={item.id} className="group relative aspect-square overflow-hidden rounded-md">
                                    <div className={`absolute inset-0 bg-linear-to-br ${item.gradient} opacity-60`} />
                                    <div className="absolute inset-0 bg-stone-950/0 transition-colors group-hover:bg-stone-950/20" />
                                    <span
                                        className={
                                            'absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm ' +
                                            (urgent ? 'bg-red-500/85 text-white' : 'bg-stone-950/55 text-white')
                                        }
                                    >
                                        {item.daysLeft}d left
                                    </span>
                                    <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                        <button
                                            aria-label="Restore"
                                            className="flex size-7 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm transition-colors hover:bg-white hover:text-stone-900"
                                        >
                                            <TbArrowBackUp className="size-4" />
                                        </button>
                                        <button
                                            aria-label="Delete forever"
                                            className="flex size-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm transition-colors hover:bg-white hover:text-red-700"
                                        >
                                            <TbTrash className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}