// dropicture/apps/saas/frontend/src/components/SessionExpired.tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { readSessionExpiredReason, clearReasonParam, type SessionExpiredReason, SESSION_EXPIRED_REASONS } from '@/lib/sessionExpiry';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Tone = 'neutral' | 'warning';

const CLOCK = (
    <>
        <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7.4V12l3 1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
);

const SHIELD = (
    <>
        <path
            d="M12 3.2 5 5.9v5.3c0 4 2.9 7.7 7 9.6 4.1-1.9 7-5.6 7-9.6V5.9l-7-2.7Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
        />
        <path d="M12 10.6v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
);

const LOGOUT = (
    <path
        d="M9.5 20H5.6A1.6 1.6 0 0 1 4 18.4V5.6A1.6 1.6 0 0 1 5.6 4h3.9M15.4 15.8 19.2 12l-3.8-3.8M19.2 12H9.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
);

const COPY: Record<
    SessionExpiredReason,
    { icon: ReactNode; title: string; description: string; tone: Tone }
> = {
    [SESSION_EXPIRED_REASONS.EXPIRED]: {
        icon: CLOCK,
        title: 'Session expirée',
        description: 'Par sécurité, tu as été déconnecté après une période d’inactivité.',
        tone: 'neutral',
    },
    [SESSION_EXPIRED_REASONS.REVOKED]: {
        icon: SHIELD,
        title: 'Session interrompue',
        description: 'Ta session a été fermée pour raison de sécurité. Reconnecte-toi.',
        tone: 'warning',
    },
    [SESSION_EXPIRED_REASONS.SIGNED_OUT]: {
        icon: LOGOUT,
        title: 'Tu es déconnecté',
        description: 'À bientôt.',
        tone: 'neutral',
    },
}


const TONES: Record<Tone, { container: string; disc: string; title: string }> = {
    neutral: {
        container: 'border-[#EAEAEA] bg-white/85',
        disc: 'border-[#EAEAEA] bg-[#FAFAFA] text-[#666]',
        title: 'text-[#171717]',
    },
    warning: {
        container: 'border-[#F5C0C2] bg-[#FEF2F2]/85',
        disc: 'border-[#F5C0C2] bg-white text-[#E5484D]',
        title: 'text-[#E5484D]',
    },
};

export const SessionExpired = ({ className = '' }: { className?: string }) => {
    const calm = useReducedMotion() === true;
    const [reason, setReason] = useState<SessionExpiredReason | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const detected = readSessionExpiredReason();
        if (detected) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setReason(detected);
            clearReasonParam();
        }
    }, []);

    const visible = Boolean(reason) && !dismissed;
    const copy = reason ? COPY[reason] : null;
    const t = copy ? TONES[copy.tone] : TONES.neutral;

    return (
        <AnimatePresence initial={false}>
            {visible && copy && (
                <motion.div
                    key={reason}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: calm ? 0 : 0.24, ease: EASE }}
                    className="overflow-hidden"
                >
                    <div
                        className={`relative flex items-start gap-3 rounded-xl border py-3 pl-3.5 pr-10 backdrop-blur-xl ${t.container} ${className}`}
                    >
                        <span
                            aria-hidden
                            className={`grid size-8 shrink-0 place-items-center rounded-lg border ${t.disc}`}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                {copy.icon}
                            </svg>
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-medium leading-snug tracking-[-0.01em] ${t.title}`}>
                                {copy.title}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-5 text-[#8F8F8F]">{copy.description}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            aria-label="Fermer"
                            className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-md text-[#A1A1A1] transition hover:bg-black/5 hover:text-[#171717] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/15"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                    d="M6.5 6.5l11 11M17.5 6.5l-11 11"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};