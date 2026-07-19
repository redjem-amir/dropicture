// dropicture/apps/saas/frontend/src/app/auth/settings/page.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useUser } from '@/components/UserProvider';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const RULES = [
    { id: 'len', label: '8 caractères minimum', test: (v: string) => v.length >= 8 && v.length <= 128 },
    { id: 'upper', label: 'Une majuscule', test: (v: string) => /[A-Z]/.test(v) },
    { id: 'lower', label: 'Une minuscule', test: (v: string) => /[a-z]/.test(v) },
    { id: 'digit', label: 'Un chiffre', test: (v: string) => /\d/.test(v) },
    { id: 'special', label: 'Un caractère spécial', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

const QUOTA = { used: 42.7, total: 200, photos: 12480, videos: 316 };

const FIELD =
    'h-10 w-full rounded-lg border border-[#EAEAEA] bg-white px-3 text-[14px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8 disabled:bg-[#FAFAFA] disabled:text-[#8F8F8F]';
const LABEL = 'mb-2 block text-[13px] font-medium text-[#171717]';
const CARD = 'overflow-hidden rounded-xl border bg-white/85 backdrop-blur-xl';
const HEAD = 'flex items-center gap-3 border-b px-5 py-3.5 sm:px-6';
const DISC = 'grid size-8 shrink-0 place-items-center rounded-lg border';
const H2 = 'min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em]';
const BODY = 'px-5 py-5 sm:px-6';
const NOTICE = 'flex items-start gap-1.5 overflow-hidden pt-3 text-[13px] leading-5';

const BTN =
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[14px] font-medium transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed';
const PRIMARY = `${BTN} bg-[#171717] text-white hover:bg-[#383838] focus-visible:ring-[#171717]/20 disabled:bg-[#EAEAEA] disabled:text-[#A1A1A1]`;
const GHOST = `${BTN} border border-[#EAEAEA] bg-white text-[#171717] hover:border-[#D4D4D4] hover:bg-[#FAFAFA] focus-visible:ring-[#171717]/15`;
const DANGER = `${BTN} bg-[#E5484D] text-white hover:bg-[#CE3B40] focus-visible:ring-[#E5484D]/25 disabled:bg-[#EAEAEA] disabled:text-[#A1A1A1]`;
const QUIET_DANGER = `${BTN} border border-[#EAEAEA] bg-white text-[#E5484D] hover:border-[#F5C0C2] hover:bg-[#FEF2F2] focus-visible:ring-[#E5484D]/20`;

export default function Page() {
    const calm = useReducedMotion() === true;
    const { user, isLoading } = useUser();

    const [firstname, setFirstname] = useState(user?.firstname ?? '');
    const [lastname, setLastname] = useState(user?.lastname ?? '');
    const [idDone, setIdDone] = useState(false);

    const [handle, setHandle] = useState('marie.frames');
    const [handleDone, setHandleDone] = useState(false);

    const [email, setEmail] = useState(user?.email ?? '');
    const [mailDone, setMailDone] = useState(false);

    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext] = useState(false);
    const [pwDone, setPwDone] = useState(false);

    const [dangerOpen, setDangerOpen] = useState(false);
    const [delPassword, setDelPassword] = useState('');
    const [showDel, setShowDel] = useState(false);

    const passed = RULES.filter((r) => r.test(next)).length;
    const pwValid = passed === RULES.length;
    const pct = Math.min(100, Math.round((QUOTA.used / QUOTA.total) * 100));

    const submit = (setter: (v: boolean) => void) => (e: FormEvent) => {
        e.preventDefault();
        setter(true);
        setTimeout(() => setter(false), 2400);
    };

    return (
        <div className="relative h-full">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
            </div>

            <div className="relative h-full overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:py-10">
                    <motion.header
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
                    >
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                            Compte
                        </p>
                        <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                            Réglages
                        </h1>
                    </motion.header>

                    {isLoading || !user ? (
                        <div className="space-y-6">
                            {[0, 1].map((i) => (
                                <div key={i} className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
                                    <div className="flex items-center gap-3 border-b border-[#EAEAEA] px-5 py-3.5">
                                        <div className="size-8 animate-pulse rounded-lg bg-[#F4F4F5]" />
                                        <div className="h-4 w-28 animate-pulse rounded-md bg-[#F4F4F5]" />
                                    </div>
                                    <div className="space-y-4 px-5 py-5">
                                        <div className="h-10 animate-pulse rounded-lg bg-[#F4F4F5]" />
                                        <div className="h-10 w-32 animate-pulse rounded-lg bg-[#F4F4F5]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, ease: EASE }}
                                className={`${CARD} border-[#EAEAEA]`}
                            >
                                <div className={`${HEAD} border-[#EAEAEA]`}>
                                    <span aria-hidden className={`${DISC} border-[#EAEAEA] bg-[#FAFAFA] text-[#666]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <ellipse cx="12" cy="6.5" rx="7.5" ry="3" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" stroke="currentColor" strokeWidth="1.7" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#171717]`}>Stockage</h2>
                                </div>

                                <div className={BODY}>
                                    <div className="flex items-baseline justify-between">
                                        <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                                            {QUOTA.used} Go
                                        </p>
                                        <p className="font-mono text-[11px] tabular-nums text-[#A1A1A1]">
                                            sur {QUOTA.total} Go · {pct} %
                                        </p>
                                    </div>

                                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F4F4F5]">
                                        <div
                                            className={`h-full rounded-full ${pct > 90 ? 'bg-[#E5484D]' : 'bg-[#171717]'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-[#8F8F8F]">
                                        <span>{QUOTA.photos.toLocaleString('fr-FR')} photos</span>
                                        <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                                        <span>{QUOTA.videos} vidéos</span>
                                    </div>

                                    <p className="mt-4 text-[13px] leading-relaxed text-[#8F8F8F]">
                                        Les éléments supprimés continuent d’occuper de l’espace pendant trente jours,
                                        le temps de pouvoir les récupérer.
                                    </p>

                                    <button type="button" className={`${GHOST} mt-4`}>
                                        Exporter toute ma bibliothèque
                                    </button>
                                </div>
                            </motion.section>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : 0.05, ease: EASE }}
                                className={`${CARD} border-[#EAEAEA]`}
                            >
                                <div className={`${HEAD} border-[#EAEAEA]`}>
                                    <span aria-hidden className={`${DISC} border-[#EAEAEA] bg-[#FAFAFA] text-[#666]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#171717]`}>Identité</h2>
                                </div>

                                <div className={BODY}>
                                    <form onSubmit={submit(setIdDone)} noValidate>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="firstname" className={LABEL}>Prénom</label>
                                                <input
                                                    id="firstname"
                                                    type="text"
                                                    autoComplete="given-name"
                                                    maxLength={30}
                                                    value={firstname}
                                                    onChange={(e) => setFirstname(e.target.value)}
                                                    className={FIELD}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="lastname" className={LABEL}>Nom</label>
                                                <input
                                                    id="lastname"
                                                    type="text"
                                                    autoComplete="family-name"
                                                    maxLength={30}
                                                    value={lastname}
                                                    onChange={(e) => setLastname(e.target.value)}
                                                    className={FIELD}
                                                />
                                            </div>
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {idDone && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                                    role="status"
                                                    className={`${NOTICE} text-[#666]`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                                                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    Profil à jour.
                                                </motion.p>
                                            )}
                                        </AnimatePresence>

                                        <button type="submit" className={`${PRIMARY} mt-5`}>Enregistrer</button>
                                    </form>
                                </div>
                            </motion.section>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : 0.1, ease: EASE }}
                                className={`${CARD} border-[#EAEAEA]`}
                            >
                                <div className={`${HEAD} border-[#EAEAEA]`}>
                                    <span aria-hidden className={`${DISC} border-[#EAEAEA] bg-[#FAFAFA] text-[#666]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.6" />
                                            <path d="M3.4 12h17.2M12 3.4a15 15 0 0 1 0 17.2M12 3.4a15 15 0 0 0 0 17.2" stroke="currentColor" strokeWidth="1.6" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#171717]`}>Adresse publique</h2>
                                </div>

                                <div className={BODY}>
                                    <form onSubmit={submit(setHandleDone)} noValidate>
                                        <label htmlFor="handle" className={LABEL}>Identifiant</label>
                                        <div className="flex items-center gap-0">
                                            <span className="flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-[#EAEAEA] bg-[#FAFAFA] px-3 font-mono text-[13px] text-[#8F8F8F]">
                                                dropicture.com/@
                                            </span>
                                            <input
                                                id="handle"
                                                type="text"
                                                value={handle}
                                                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                                                maxLength={30}
                                                className={`${FIELD} rounded-l-none font-mono`}
                                            />
                                        </div>
                                        <p className="mt-2 text-[12px] leading-5 text-[#8F8F8F]">
                                            Changer d’identifiant casse les liens déjà partagés vers ta page publique.
                                        </p>

                                        <AnimatePresence initial={false}>
                                            {handleDone && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                                    role="status"
                                                    className={`${NOTICE} text-[#666]`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                                                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    Adresse mise à jour.
                                                </motion.p>
                                            )}
                                        </AnimatePresence>

                                        <button type="submit" className={`${PRIMARY} mt-5`}>Mettre à jour</button>
                                    </form>
                                </div>
                            </motion.section>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : 0.15, ease: EASE }}
                                className={`${CARD} border-[#EAEAEA]`}
                            >
                                <div className={`${HEAD} border-[#EAEAEA]`}>
                                    <span aria-hidden className={`${DISC} border-[#EAEAEA] bg-[#FAFAFA] text-[#666]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="m4 8 8 5.5L20 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#171717]`}>Adresse e-mail</h2>
                                </div>

                                <div className={BODY}>
                                    <form onSubmit={submit(setMailDone)} noValidate>
                                        <label htmlFor="email" className={LABEL}>E-mail</label>
                                        <input
                                            id="email"
                                            type="email"
                                            inputMode="email"
                                            autoComplete="username"
                                            autoCapitalize="none"
                                            spellCheck={false}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={FIELD}
                                        />
                                        <p className="mt-2 text-[12px] leading-5 text-[#8F8F8F]">
                                            C’est aussi ton identifiant de connexion. Jamais affiché publiquement.
                                        </p>

                                        <AnimatePresence initial={false}>
                                            {mailDone && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                                    role="status"
                                                    className={`${NOTICE} text-[#666]`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                                                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    E-mail mis à jour.
                                                </motion.p>
                                            )}
                                        </AnimatePresence>

                                        <button type="submit" className={`${PRIMARY} mt-5`}>Mettre à jour</button>
                                    </form>
                                </div>
                            </motion.section>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : 0.2, ease: EASE }}
                                className={`${CARD} border-[#EAEAEA]`}
                            >
                                <div className={`${HEAD} border-[#EAEAEA]`}>
                                    <span aria-hidden className={`${DISC} border-[#EAEAEA] bg-[#FAFAFA] text-[#666]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
                                            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#171717]`}>Mot de passe</h2>
                                </div>

                                <div className={BODY}>
                                    <form onSubmit={submit(setPwDone)} noValidate className="space-y-4">
                                        <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden aria-hidden tabIndex={-1} />

                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <label htmlFor="current-password" className="text-[13px] font-medium text-[#171717]">
                                                    Mot de passe actuel
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrent((v) => !v)}
                                                    className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                                >
                                                    {showCurrent ? 'Masquer' : 'Afficher'}
                                                </button>
                                            </div>
                                            <input
                                                id="current-password"
                                                type={showCurrent ? 'text' : 'password'}
                                                autoComplete="current-password"
                                                placeholder="••••••••••••"
                                                value={current}
                                                onChange={(e) => setCurrent(e.target.value)}
                                                className={FIELD}
                                            />
                                        </div>

                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <label htmlFor="new-password" className="text-[13px] font-medium text-[#171717]">
                                                    Nouveau mot de passe
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNext((v) => !v)}
                                                    className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                                >
                                                    {showNext ? 'Masquer' : 'Afficher'}
                                                </button>
                                            </div>
                                            <input
                                                id="new-password"
                                                type={showNext ? 'text' : 'password'}
                                                autoComplete="new-password"
                                                placeholder="••••••••••••"
                                                value={next}
                                                onChange={(e) => setNext(e.target.value)}
                                                className={FIELD}
                                            />
                                            <div className="mt-3 flex gap-1">
                                                {RULES.map((r, i) => (
                                                    <motion.span
                                                        key={r.id}
                                                        className="h-0.75 flex-1 rounded-full"
                                                        initial={false}
                                                        animate={{ backgroundColor: i < passed ? '#171717' : '#EAEAEA' }}
                                                        transition={{ duration: calm ? 0 : 0.25 }}
                                                    />
                                                ))}
                                            </div>

                                            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                                                {RULES.map((r) => {
                                                    const ok = r.test(next);
                                                    return (
                                                        <li
                                                            key={r.id}
                                                            className={`flex items-center gap-1.5 text-[12px] transition-colors ${ok ? 'text-[#171717]' : 'text-[#A1A1A1]'
                                                                }`}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                                                                {ok ? (
                                                                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                                                ) : (
                                                                    <circle cx="12" cy="12" r="3.4" fill="currentColor" />
                                                                )}
                                                            </svg>
                                                            {r.label}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        <AnimatePresence initial={false}>
                                            {pwDone && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                                    role="status"
                                                    className={`${NOTICE} text-[#666]`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                                                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    Mot de passe changé. Tes autres appareils ont été déconnectés.
                                                </motion.p>
                                            )}
                                        </AnimatePresence>

                                        <button type="submit" disabled={!current || !pwValid} className={PRIMARY}>
                                            Changer le mot de passe
                                        </button>
                                    </form>
                                </div>
                            </motion.section>
                            <motion.section
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: calm ? 0 : 0.45, delay: calm ? 0 : 0.25, ease: EASE }}
                                className={`${CARD} border-[#F5C0C2]`}
                            >
                                <div className={`${HEAD} border-[#F5C0C2]`}>
                                    <span aria-hidden className={`${DISC} border-[#F5C0C2] bg-[#FEF2F2] text-[#E5484D]`}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                                            <path d="M10.29 4.86 2.82 18a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 4.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                            <path d="M12 9.5v4M12 17h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                    <h2 className={`${H2} text-[#E5484D]`}>Supprimer le compte</h2>
                                </div>

                                <div className={BODY}>
                                    <p className="text-[14px] leading-relaxed text-[#666]">
                                        Ta bibliothèque, tes galeries publiées et ta page publique sont effacées.
                                        C’est définitif.
                                    </p>

                                    <AnimatePresence initial={false} mode="wait">
                                        {dangerOpen ? (
                                            <motion.form
                                                key="form"
                                                onSubmit={(e) => e.preventDefault()}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-4">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <label htmlFor="delete-password" className="text-[13px] font-medium text-[#171717]">
                                                            Confirme avec ton mot de passe
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowDel((v) => !v)}
                                                            className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                                                        >
                                                            {showDel ? 'Masquer' : 'Afficher'}
                                                        </button>
                                                    </div>
                                                    <input
                                                        id="delete-password"
                                                        type={showDel ? 'text' : 'password'}
                                                        autoComplete="current-password"
                                                        placeholder="••••••••••••"
                                                        value={delPassword}
                                                        onChange={(e) => setDelPassword(e.target.value)}
                                                        className={FIELD}
                                                    />
                                                </div>

                                                <div className="mt-5 flex items-center gap-2">
                                                    <button type="submit" disabled={!delPassword} className={DANGER}>
                                                        Supprimer définitivement
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDangerOpen(false);
                                                            setDelPassword('');
                                                            setShowDel(false);
                                                        }}
                                                        className={GHOST}
                                                    >
                                                        Annuler
                                                    </button>
                                                </div>
                                            </motion.form>
                                        ) : (
                                            <motion.div
                                                key="trigger"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: calm ? 0 : 0.15 }}
                                                className="mt-4"
                                            >
                                                <button type="button" onClick={() => setDangerOpen(true)} className={QUIET_DANGER}>
                                                    Supprimer mon compte
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}