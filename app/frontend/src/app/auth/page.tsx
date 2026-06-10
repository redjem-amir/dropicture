// dropicture/app/frontend/src/app/auth/page.tsx
//
// Photos — the chronological timeline, and the home of the app.
// Self-contained: mock data and styles are inlined; no shared imports.
// NOTE: this route's metadata belongs in the existing /auth/layout.tsx.
import { TbHeartFilled, TbPlayerPlayFilled, TbUpload } from 'react-icons/tb'

// Placeholder photos are CSS gradients — no network, privacy-consistent.
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
const gradientFor = (s: number) => GRADIENTS[((s % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length]

type Photo = { id: string; gradient: string; favorite?: boolean; video?: boolean; duration?: string }

function makePhotos(n: number, offset = 0, opts: { favEvery?: number; vidEvery?: number } = {}): Photo[] {
    const { favEvery = 0, vidEvery = 0 } = opts
    return Array.from({ length: n }, (_, i) => {
        const s = offset + i
        const video = vidEvery > 0 && s % vidEvery === 0
        return {
            id: `p${s}`,
            gradient: gradientFor(s),
            favorite: favEvery > 0 && s % favEvery === 0,
            video,
            duration: video ? `0:${10 + (s % 49)}` : undefined,
        }
    })
}

const LIBRARY_TOTAL = 12418
const TIMELINE: { date: string; photos: Photo[] }[] = [
    { date: 'Today', photos: makePhotos(7, 0, { favEvery: 4, vidEvery: 6 }) },
    { date: 'Yesterday', photos: makePhotos(11, 7, { favEvery: 5 }) },
    { date: 'Sunday · March 15', photos: makePhotos(16, 18, { vidEvery: 7, favEvery: 6 }) },
    { date: 'March 9, 2026', photos: makePhotos(13, 34, { favEvery: 5 }) },
]

const BTN_PRIMARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700'
const BTN_SECONDARY =
    'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'

export default function PhotosPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Photos</h1>
                    <p className="mt-1 text-sm text-stone-500">{LIBRARY_TOTAL.toLocaleString()} items</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button className={BTN_SECONDARY}>Select</button>
                    <button className={BTN_PRIMARY}>
                        <TbUpload className="size-4" />
                        Upload
                    </button>
                </div>
            </div>

            {TIMELINE.map(group => (
                <section key={group.date}>
                    <h2 className="mb-3 text-sm font-semibold tracking-tight text-stone-900">{group.date}</h2>
                    <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                        {group.photos.map(p => (
                            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md">
                                <div className={`absolute inset-0 bg-linear-to-br ${p.gradient}`} />
                                <div className="absolute inset-0 bg-stone-950/0 transition-colors group-hover:bg-stone-950/15" />
                                <span className="absolute left-2 top-2 size-5 rounded-full border-2 border-white/90 bg-stone-900/10 opacity-0 shadow-sm transition-opacity group-hover:opacity-100" />
                                {p.video && (
                                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-stone-950/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                        <TbPlayerPlayFilled className="size-2.5" />
                                        {p.duration}
                                    </span>
                                )}
                                {p.favorite && (
                                    <TbHeartFilled className="absolute bottom-2 left-2 size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}