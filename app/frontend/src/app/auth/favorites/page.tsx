// dropicture/app/frontend/src/app/auth/favorites/page.tsx
import { TbHeart, TbHeartFilled } from 'react-icons/tb'

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

type Photo = { id: string; gradient: string }
const FAVORITES: Photo[] = Array.from({ length: 18 }, (_, i) => ({
    id: `f${i}`,
    gradient: GRADIENTS[(i + 6) % GRADIENTS.length],
}))

export default function FavoritesPage() {
    const photos = FAVORITES

    return (
        <div className="space-y-8">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Favorites</h1>
                <p className="mt-1 text-sm text-stone-500">{photos.length} items</p>
            </div>

            {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm">
                        <TbHeart className="size-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-stone-900">No favorites yet</h3>
                    <p className="mt-1 max-w-sm text-sm text-stone-500">
                        Tap the heart on any photo to keep it close. They&apos;ll all gather here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                    {photos.map(p => (
                        <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md">
                            <div className={`absolute inset-0 bg-linear-to-br ${p.gradient}`} />
                            <div className="absolute inset-0 bg-stone-950/0 transition-colors group-hover:bg-stone-950/15" />
                            <span className="absolute left-2 top-2 size-5 rounded-full border-2 border-white/90 bg-stone-900/10 opacity-0 shadow-sm transition-opacity group-hover:opacity-100" />
                            <TbHeartFilled className="absolute bottom-2 left-2 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}