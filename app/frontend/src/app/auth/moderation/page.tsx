// dropicture/app/frontend/src/app/auth/moderation/page.tsx
'use client'

import { useState } from 'react'
import { TbInbox } from 'react-icons/tb'

type ReportStatus = 'pending' | 'resolved' | 'dismissed'
type Report = {
    id: string
    reason: string
    detail: string
    reporter: string
    date: string
    gradient: string
    status: ReportStatus
}
const REPORTS: Report[] = [
    { id: 'rp1', reason: 'Copyright', detail: 'Reported as an unlicensed reproduction of a stock image.', reporter: 'mira.costa@gmail.com', date: '2h ago', gradient: 'from-violet-200 to-fuchsia-300', status: 'pending' },
    { id: 'rp2', reason: 'Illegal content', detail: 'Flagged for review under the acceptable-use policy.', reporter: 'system', date: '6h ago', gradient: 'from-stone-200 to-stone-400', status: 'pending' },
    { id: 'rp3', reason: 'Spam', detail: 'Bulk-shared link flagged by multiple recipients.', reporter: 'kweber@posteo.de', date: 'Yesterday', gradient: 'from-sky-200 to-indigo-300', status: 'pending' },
    { id: 'rp4', reason: 'Copyright', detail: 'Resolved — content removed and uploader notified.', reporter: 'ada@dropicture.com', date: 'Mar 14', gradient: 'from-rose-200 to-pink-300', status: 'resolved' },
    { id: 'rp5', reason: 'Other', detail: 'Dismissed — no policy violation found.', reporter: 'anon', date: 'Mar 11', gradient: 'from-indigo-200 to-violet-300', status: 'dismissed' },
]

const TABS: { id: ReportStatus; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'dismissed', label: 'Dismissed' },
]

const BADGE_BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium'
const BTN_SECONDARY_SM =
    'inline-flex h-8 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'
const BTN_DANGER_SM =
    'inline-flex h-8 items-center justify-center gap-2 rounded-full bg-red-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-500'

function reasonTone(status: ReportStatus): string {
    if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700'
    if (status === 'resolved') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    return 'border-stone-200 bg-stone-50 text-stone-600'
}

export default function ModerationPage() {
    const [tab, setTab] = useState<ReportStatus>('pending')
    const reports = REPORTS.filter(r => r.status === tab)
    const pendingCount = REPORTS.filter(r => r.status === 'pending').length

    return (
        <div className="space-y-6">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Moderation</h1>
                <p className="mt-1 text-sm text-stone-500">
                    {pendingCount > 0 ? `${pendingCount} reports awaiting review` : 'No reports awaiting review'}
                </p>
            </div>

            <div className="inline-flex rounded-full border border-stone-200 bg-white p-1 shadow-sm">
                {TABS.map(t => {
                    const count = REPORTS.filter(r => r.status === t.id).length
                    const active = tab === t.id
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={
                                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                                (active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')
                            }
                        >
                            {t.label}
                            <span className={active ? 'ml-1.5 text-white/70' : 'ml-1.5 text-stone-400'}>{count}</span>
                        </button>
                    )
                })}
            </div>

            {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/40 px-6 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm">
                        <TbInbox className="size-6" strokeWidth={1.5} />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-stone-900">Nothing here</h3>
                    <p className="mt-1 max-w-sm text-sm text-stone-500">
                        When something is reported under the acceptable-use policy, it lands in this queue.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map(report => (
                        <div key={report.id} className="flex items-start gap-4 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
                            <div className={`size-14 shrink-0 rounded-lg bg-linear-to-br ${report.gradient}`} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`${BADGE_BASE} ${reasonTone(report.status)}`}>{report.reason}</span>
                                    <span className="text-xs text-stone-400">
                                        Reported by {report.reporter} · {report.date}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-stone-600">{report.detail}</p>
                            </div>
                            {report.status === 'pending' && (
                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                                    <button className={BTN_SECONDARY_SM}>Dismiss</button>
                                    <button className={BTN_DANGER_SM}>Remove</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}