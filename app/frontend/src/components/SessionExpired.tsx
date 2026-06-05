// dropicture/app/frontend/src/components/SessionExpired.tsx
'use client'

import { useEffect, useState } from 'react'
import { TbClock, TbShieldLock, TbLogout, TbX } from 'react-icons/tb'
import {
    readSessionExpiredReason,
    clearReasonParam,
    type SessionExpiredReason,
    SESSION_EXPIRED_REASONS,
} from '@/lib/sessionExpiry'

type Tone = 'neutral' | 'warning'

const COPY: Record<
    SessionExpiredReason,
    {
        icon: React.ComponentType<{ className?: string }>
        title: string
        description: string
        tone: Tone
    }
> = {
    [SESSION_EXPIRED_REASONS.EXPIRED]: {
        icon: TbClock,
        title: 'Your session has expired',
        description: 'For your security, you were signed out after a period of inactivity.',
        tone: 'neutral',
    },
    [SESSION_EXPIRED_REASONS.REVOKED]: {
        icon: TbShieldLock,
        title: 'Session interrupted',
        description: 'Your session was ended for security reasons. Please sign in again.',
        tone: 'warning',
    },
    [SESSION_EXPIRED_REASONS.SIGNED_OUT]: {
        icon: TbLogout,
        title: 'You are signed out',
        description: 'See you soon on Dropicture.',
        tone: 'neutral',
    },
}

const TONES: Record<
    Tone,
    { container: string; iconBg: string; iconColor: string; title: string; desc: string; close: string }
> = {
    neutral: {
        container: 'border-stone-200/80 bg-white/80 backdrop-blur-sm',
        iconBg: 'bg-stone-100',
        iconColor: 'text-stone-500',
        title: 'text-stone-900',
        desc: 'text-stone-500',
        close: 'text-stone-400 hover:bg-stone-100 hover:text-stone-900',
    },
    warning: {
        container: 'border-amber-200 bg-amber-50',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        title: 'text-amber-900',
        desc: 'text-amber-700',
        close: 'text-amber-500 hover:bg-amber-100 hover:text-amber-900',
    },
}

export const SessionExpired = ({ className = '' }: { className?: string }) => {
    const [reason, setReason] = useState<SessionExpiredReason | null>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const detected = readSessionExpiredReason()
        if (detected) {
            setReason(detected)
            clearReasonParam()
        }
    }, [])

    if (!reason || dismissed) return null

    const { icon: Icon, title, description, tone } = COPY[reason]
    const t = TONES[tone]

    return (
        <>
            <style>{`
                @keyframes dpNoticeIn { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { [data-anim] { animation: none !important; } }
            `}</style>
            <div
                role="status"
                aria-live="polite"
                data-anim
                style={{ animation: 'dpNoticeIn 220ms cubic-bezier(0.16,1,0.3,1)' }}
                className={`relative flex items-start gap-3 rounded-xl border px-3.5 py-3 pr-10 shadow-[0_4px_20px_-8px_rgba(28,25,23,0.12)] ${t.container} ${className}`}
            >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
                    <Icon className={`size-4 ${t.iconColor}`} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                    <p className={`text-[13px] font-medium leading-snug tracking-tight ${t.title}`}>
                        {title}
                    </p>
                    <p className={`mt-0.5 text-xs leading-relaxed ${t.desc}`}>{description}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss"
                    className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 ${t.close}`}
                >
                    <TbX className="size-3.5" />
                </button>
            </div>
        </>
    )
}