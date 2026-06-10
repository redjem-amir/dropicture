// dropicture/app/frontend/src/app/auth/albums/page.tsx
import Link from 'next/link'
import { TbPlus } from 'react-icons/tb'

type Album = { id: string; name: string; count: number; gradient: string; updated: string }
const ALBUMS: Album[] = [
    { id: 'a1', name: 'Summer in Lisbon', count: 142, gradient: 'from-amber-200 to-orange-300', updated: '2 days ago' },
    { id: 'a2', name: 'Family', count: 803, gradient: 'from-emerald-200 to-teal-300', updated: 'last week' },
    { id: 'a3', name: 'Mountains 2025', count: 67, gradient: 'from-sky-200 to-indigo-300', updated: '3 weeks ago' },
    { id: 'a4', name: 'Studio work', count: 219, gradient: 'from-violet-200 to-fuchsia-300', updated: 'a month ago' },
    { id: 'a5', name: 'Street', count: 488, gradient: 'from-orange-200 to-rose-300', updated: 'a month ago' },
    { id: 'a6', name: 'Recipes', count: 54, gradient: 'from-lime-200 to-emerald-300', updated: '2 months ago' },
    { id: 'a7', name: 'Concerts', count: 131, gradient: 'from-indigo-200 to-violet-300', updated: '3 months ago' },
    { id: 'a8', name: 'Screenshots', count: 1290, gradient: 'from-stone-200 to-stone-400', updated: 'last year' },
]

const BTN_PRIMARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700'

export default function AlbumsPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Albums</h1>
                    <p className="mt-1 text-sm text-stone-500">{ALBUMS.length} albums</p>
                </div>
                <button className={BTN_PRIMARY}>
                    <TbPlus className="size-4" />
                    New album
                </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {ALBUMS.map(album => (
                    <Link key={album.id} href={`/auth/albums/${album.id}`} className="group block">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-stone-200/70 shadow-sm">
                            <div className={`absolute inset-0 bg-linear-to-br ${album.gradient} transition-transform duration-300 group-hover:scale-105`} />
                            <div className="absolute inset-0 bg-stone-950/0 transition-colors group-hover:bg-stone-950/10" />
                        </div>
                        <div className="mt-2.5">
                            <p className="truncate text-sm font-medium text-stone-900">{album.name}</p>
                            <p className="mt-0.5 text-xs text-stone-400">
                                {album.count.toLocaleString()} items · {album.updated}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}