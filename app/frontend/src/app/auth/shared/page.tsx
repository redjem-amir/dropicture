// dropicture/app/frontend/src/app/auth/shared/page.tsx
import { TbLink, TbShare2 } from 'react-icons/tb'

type Share = {
    id: string
    name: string
    kind: 'Album' | 'Photo' | 'Selection'
    items: number
    gradient: string
    created: string
    expiresInDays: number | null
    views: number
}
const SHARES: Share[] = [
    { id: 's1', name: 'Summer in Lisbon', kind: 'Album', items: 142, gradient: 'from-amber-200 to-orange-300', created: 'Mar 12', expiresInDays: 5, views: 38 },
    { id: 's2', name: 'Birthday selection', kind: 'Selection', items: 24, gradient: 'from-rose-200 to-pink-300', created: 'Mar 8', expiresInDays: null, views: 211 },
    { id: 's3', name: 'Portrait — final', kind: 'Photo', items: 1, gradient: 'from-violet-200 to-fuchsia-300', created: 'Feb 28', expiresInDays: 1, views: 7 },
    { id: 's4', name: 'Mountains 2025', kind: 'Album', items: 67, gradient: 'from-sky-200 to-indigo-300', created: 'Feb 20', expiresInDays: 30, views: 92 },
]

const BADGE_BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium'
const BTN_SECONDARY_SM =
    'inline-flex h-8 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'
const BTN_REVOKE_SM =
    'inline-flex h-8 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700'

function expiry(share: Share): { tone: string; label: string } {
    if (share.expiresInDays === null) return { tone: 'border-stone-200 bg-stone-50 text-stone-600', label: 'Never expires' }
    if (share.expiresInDays <= 1) return { tone: 'border-amber-200 bg-amber-50 text-amber-700', label: 'Expires today' }
    if (share.expiresInDays <= 7) return { tone: 'border-amber-200 bg-amber-50 text-amber-700', label: `${share.expiresInDays} days left` }
    return { tone: 'border-stone-200 bg-stone-50 text-stone-600', label: `${share.expiresInDays} days left` }
}

export default function SharingPage() {
    return (
        <div className="space-y-6">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Sharing</h1>
                <p className="mt-1 text-sm text-stone-500">
                    Anyone with a link can view what it points to — and nothing else. Revoke anytime.
                </p>
            </div>

            {SHARES.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm">
                        <TbShare2 className="size-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-stone-900">Nothing shared</h3>
                    <p className="mt-1 max-w-sm text-sm text-stone-500">
                        When you share an album or a selection, the link shows up here so you stay in control of it.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white shadow-sm">
                    {SHARES.map(share => {
                        const e = expiry(share)
                        return (
                            <div key={share.id} className="flex items-center gap-4 p-4">
                                <div className={`size-11 shrink-0 rounded-lg bg-linear-to-br ${share.gradient}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-stone-900">{share.name}</p>
                                    <p className="mt-0.5 truncate text-xs text-stone-400">
                                        {share.kind} · {share.items.toLocaleString()} items · Shared {share.created} · {share.views} views
                                    </p>
                                </div>
                                <div className="hidden shrink-0 sm:block">
                                    <span className={`${BADGE_BASE} ${e.tone}`}>{e.label}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button className={BTN_SECONDARY_SM}>
                                        <TbLink className="size-4" />
                                        <span className="hidden md:inline">Copy link</span>
                                    </button>
                                    <button className={BTN_REVOKE_SM}>Revoke</button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}