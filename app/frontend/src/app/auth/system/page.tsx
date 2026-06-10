// dropicture/app/frontend/src/app/auth/system/page.tsx

const INSTANCE = {
    storageUsedTB: 1.84,
    storageTotalTB: 4,
    users: 3127,
    photos: 1284502,
    signups7d: 86,
    uptime: '99.98%',
    region: 'Falkenstein, DE',
    version: 'v0.9.2',
}

const CARD = 'rounded-2xl border border-stone-200/70 bg-white shadow-sm'

export default function InstancePage() {
    const pct = Math.round((INSTANCE.storageUsedTB / INSTANCE.storageTotalTB) * 100)
    const stats = [
        { label: 'Storage used', value: `${INSTANCE.storageUsedTB} TB`, sub: `of ${INSTANCE.storageTotalTB} TB` },
        { label: 'Users', value: INSTANCE.users.toLocaleString(), sub: undefined as string | undefined },
        { label: 'Photos', value: `${(INSTANCE.photos / 1_000_000).toFixed(2)}M`, sub: undefined as string | undefined },
        { label: 'Sign-ups · 7d', value: `+${INSTANCE.signups7d}`, sub: undefined as string | undefined },
    ]
    const details = [
        { label: 'Region', value: INSTANCE.region },
        { label: 'Uptime · 30d', value: INSTANCE.uptime },
        { label: 'Version', value: INSTANCE.version },
        { label: 'License', value: 'MIT' },
    ]

    return (
        <div className="space-y-8">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Instance</h1>
                <p className="mt-1 text-sm text-stone-500">Health and usage of this Dropicture instance.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(s => (
                    <div key={s.label} className={`${CARD} p-5`}>
                        <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-stone-400">{s.label}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{s.value}</p>
                        {s.sub && <p className="mt-0.5 text-xs text-stone-400">{s.sub}</p>}
                    </div>
                ))}
            </div>

            <div className={`${CARD} p-6`}>
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-stone-900">Storage</h2>
                    <span className="text-xs text-stone-400">
                        {INSTANCE.storageUsedTB} TB of {INSTANCE.storageTotalTB} TB · {pct}%
                    </span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-stone-900" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-stone-400">Object storage on Garage, hosted in {INSTANCE.region}.</p>
            </div>

            <div className={`${CARD} p-6`}>
                <h2 className="text-sm font-semibold text-stone-900">Details</h2>
                <dl className="mt-2 divide-y divide-stone-200/70">
                    {details.map(d => (
                        <div key={d.label} className="flex items-center justify-between gap-4 py-3">
                            <dt className="text-sm text-stone-500">{d.label}</dt>
                            <dd className="text-sm font-medium text-stone-900">{d.value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    )
}