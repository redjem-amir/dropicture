// dropicture/apps/saas/frontend/src/app/signup/page.tsx
'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const SIGNIN_PATH = '/';
const DEFAULT_NEXT = '/app';
const BRAND = 'Dropicture';
const SITE = 'https://dropicture.com';
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const NAME_RE = /^[a-zA-ZÀ-ÿ\s'-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_]|\.(?!\.)){1,28}[a-z0-9]$/;

const STEPS = ['Profil', 'Identifiant', 'E-mail', 'Mot de passe'] as const;
type Step = 1 | 2 | 3 | 4;

const RULES = [
  { id: 'len', label: '8 caractères minimum', test: (v: string) => v.length >= 8 && v.length <= 128 },
  { id: 'upper', label: 'Une majuscule', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'Une minuscule', test: (v: string) => /[a-z]/.test(v) },
  { id: 'digit', label: 'Un chiffre', test: (v: string) => /\d/.test(v) },
  { id: 'special', label: 'Un caractère spécial', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_FIELDS: 'Remplis tous les champs.',
  INVALID_NAME: 'Lettres, espaces, apostrophes et tirets uniquement (2 à 30 caractères).',
  USERNAME_TOO_SHORT: 'L’identifiant fait au moins 3 caractères.',
  USERNAME_TOO_LONG: 'L’identifiant fait au plus 30 caractères.',
  USERNAME_INVALID: 'Minuscules, chiffres, points et tirets bas. Doit commencer et finir par une lettre ou un chiffre.',
  USERNAME_RESERVED: 'Cet identifiant est réservé. Choisis-en un autre.',
  USERNAME_ALREADY_USED: 'Cet identifiant est déjà pris.',
  EMAIL_INVALID: 'Cette adresse e-mail n’est pas valide.',
  EMAIL_ALREADY_USED: 'Un compte existe déjà avec cet e-mail.',
  PASSWORD_TOO_SHORT: 'Le mot de passe fait au moins 8 caractères.',
  PASSWORD_TOO_LONG: 'Le mot de passe fait au plus 128 caractères.',
  PASSWORD_MISSING_UPPERCASE: 'Il manque une majuscule.',
  PASSWORD_MISSING_LOWERCASE: 'Il manque une minuscule.',
  PASSWORD_MISSING_NUMBER: 'Il manque un chiffre.',
  PASSWORD_MISSING_SPECIAL: 'Il manque un caractère spécial.',
  TOO_MANY_EMAILS: 'Trop de tentatives pour cet e-mail. Réessaie dans quelques minutes.',
  RATE_LIMITED: 'Trop de tentatives. Attends un instant.',
  UNKNOWN: 'Le serveur ne répond pas. Réessaie.',
};

const CODE_TO_STEP: Record<string, Step> = {
  MISSING_FIELDS: 1,
  INVALID_NAME: 1,
  USERNAME_TOO_SHORT: 2,
  USERNAME_TOO_LONG: 2,
  USERNAME_INVALID: 2,
  USERNAME_RESERVED: 2,
  USERNAME_ALREADY_USED: 2,
  EMAIL_INVALID: 3,
  EMAIL_ALREADY_USED: 3,
  PASSWORD_TOO_SHORT: 4,
  PASSWORD_TOO_LONG: 4,
  PASSWORD_MISSING_UPPERCASE: 4,
  PASSWORD_MISSING_LOWERCASE: 4,
  PASSWORD_MISSING_NUMBER: 4,
  PASSWORD_MISSING_SPECIAL: 4,
};

const suggestUsername = (firstname: string, lastname: string) =>
  `${firstname}.${lastname}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 30);

type Tile = { w: string; kind: 'plain' | 'hatch' | 'clip' };

const ROWS: Tile[][] = [
  [{ w: 'w-72', kind: 'hatch' }, { w: 'w-36', kind: 'plain' }, { w: 'w-54', kind: 'clip' }, { w: 'w-45', kind: 'plain' }],
  [{ w: 'w-45', kind: 'clip' }, { w: 'w-63', kind: 'plain' }, { w: 'w-36', kind: 'hatch' }, { w: 'w-54', kind: 'clip' }],
  [{ w: 'w-54', kind: 'plain' }, { w: 'w-45', kind: 'hatch' }, { w: 'w-72', kind: 'clip' }, { w: 'w-36', kind: 'plain' }],
  [{ w: 'w-36', kind: 'clip' }, { w: 'w-72', kind: 'plain' }, { w: 'w-45', kind: 'hatch' }, { w: 'w-63', kind: 'plain' }],
  [{ w: 'w-63', kind: 'hatch' }, { w: 'w-54', kind: 'clip' }, { w: 'w-36', kind: 'plain' }, { w: 'w-45', kind: 'hatch' }],
];

const ROW_H = ['h-36', 'h-27', 'h-45', 'h-27', 'h-36'];

const FADE = 'mask-[radial-gradient(ellipse_92%_84%_at_50%_46%,#000_28%,transparent_100%)]';

const FIELD =
  'h-10 w-full rounded-lg border bg-white px-3 text-[14px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8 disabled:bg-[#FAFAFA] disabled:text-[#8F8F8F]';

const KBD =
  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[#EAEAEA] bg-[#FAFAFA] px-1 font-mono text-[10px] leading-none text-[#8F8F8F]';

const SWAP = {
  enter: (d: number) => ({ opacity: 0, x: 20 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: -20 * d }),
};

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid';

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = use(searchParams);
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && /^\/(?!\/)/.test(raw) ? raw : DEFAULT_NEXT;
  const signinHref =
    next !== DEFAULT_NEXT ? `${SIGNIN_PATH}?next=${encodeURIComponent(next)}` : SIGNIN_PATH;

  const calm = useReducedMotion() === true;

  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState<1 | -1>(1);
  const [done, setDone] = useState(false);
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [username, setUsername] = useState('');
  const [checked, setChecked] = useState<{ user: string; result: 'free' | 'taken' | 'idle' } | null>(
    null,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstnameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handle = username.trim();
  const availability: Availability = !handle
    ? 'idle'
    : !USERNAME_RE.test(handle)
      ? 'invalid'
      : checked?.user === handle
        ? checked.result
        : 'checking';

  const goTo = (n: Step) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  useEffect(() => {
    if (done) return;
    const refs = { 1: firstnameRef, 2: usernameRef, 3: emailRef, 4: passwordRef } as const;
    const t = window.setTimeout(() => refs[step].current?.focus(), calm ? 0 : 180);
    return () => window.clearTimeout(t);
  }, [step, calm, done]);

  useEffect(() => {
    if (!handle || !USERNAME_RE.test(handle)) return;
    if (checked?.user === handle) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/username/${encodeURIComponent(handle)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setChecked({ user: handle, result: data.available ? 'free' : 'taken' });
      } catch {
        if (!controller.signal.aborted) setChecked({ user: handle, result: 'idle' });
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [handle, checked]);

  const passed = RULES.filter((r) => r.test(password)).length;
  const passwordOk = passed === RULES.length;

  const back = () => {
    if (loading || step === 1) return;
    setError(null);
    goTo((step - 1) as Step);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Escape') back();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (step === 1) {
      const f = firstname.trim();
      const l = lastname.trim();
      if (!f || !l) return setError(ERROR_MESSAGES.MISSING_FIELDS);
      const ok = (v: string) => v.length >= 2 && v.length <= 30 && NAME_RE.test(v);
      if (!ok(f) || !ok(l)) return setError(ERROR_MESSAGES.INVALID_NAME);
      if (!username) {
        const seed = suggestUsername(f, l);
        if (seed.length >= 3) setUsername(seed);
      }
      return goTo(2);
    }

    if (step === 2) {
      if (!USERNAME_RE.test(handle)) return setError(ERROR_MESSAGES.USERNAME_INVALID);
      if (availability === 'taken') return setError(ERROR_MESSAGES.USERNAME_ALREADY_USED);
      setUsername(handle);
      return goTo(3);
    }

    if (step === 3) {
      if (!EMAIL_RE.test(email.trim())) return setError(ERROR_MESSAGES.EMAIL_INVALID);
      return goTo(4);
    }

    if (!passwordOk) {
      return setError('Ton mot de passe ne remplit pas encore toutes les conditions.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          username: handle.toLowerCase(),
          email: email.trim(),
          password,
        }),
      });
      if (res.ok) {
        setLoading(false);
        setDone(true);
        return;
      }
      const data = await res.json().catch(() => null);
      const code: string =
        data?.code ?? (Array.isArray(data?.message) ? data.message[0] : data?.message);
      if (res.status === 429) {
        setError(
          code === 'TOO_MANY_EMAILS' ? ERROR_MESSAGES.TOO_MANY_EMAILS : ERROR_MESSAGES.RATE_LIMITED,
        );
      } else {
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN);
        const target = CODE_TO_STEP[code];
        if (target) {
          if (target === 2) setChecked({ user: handle, result: 'taken' });
          goTo(target);
        }
      }
    } catch {
      setError(ERROR_MESSAGES.UNKNOWN);
    }
    setLoading(false);
  };

  const ready =
    step === 1
      ? firstname.trim().length > 0 && lastname.trim().length > 0
      : step === 2
        ? USERNAME_RE.test(handle) && availability !== 'taken' && availability !== 'checking'
        : step === 3
          ? email.trim().length > 0
          : passwordOk;

  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-white font-sans text-[#171717] antialiased">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] ${FADE}`}
      />
      <div aria-hidden className={`pointer-events-none absolute inset-0 ${FADE}`}>
        <div className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0_31.5px,#D4D4D8_31.5px_40.5px,transparent_40.5px_72px)] mask-[repeating-linear-gradient(to_bottom,transparent_0_36px,#000_36px_37px,transparent_37px_72px)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0_31.5px,#D4D4D8_31.5px_40.5px,transparent_40.5px_72px)] mask-[repeating-linear-gradient(to_right,transparent_0_36px,#000_36px_37px,transparent_37px_72px)]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-4 mask-[radial-gradient(ellipse_52%_56%_at_50%_48%,transparent_42%,#000_90%),linear-gradient(to_right,transparent_0%,#000_12%,#000_88%,transparent_100%)] mask-intersect [-webkit-mask-composite:source-in]"
      >
        {ROWS.map((row, ri) => (
          <motion.div
            key={ri}
            className={`flex w-max shrink-0 gap-4 ${ROW_H[ri]}`}
            animate={calm ? undefined : { x: ri % 2 === 0 ? ['0%', '-50%'] : ['-50%', '0%'] }}
            transition={{ duration: 58 + ri * 9, repeat: Infinity, ease: 'linear' }}
          >
            {[...row, ...row, ...row, ...row].map((t, i) => (
              <figure
                key={`${ri}-${i}`}
                className={`relative h-full shrink-0 overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white ${t.w}`}
              >
                {t.kind === 'hatch' && (
                  <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(9,9,11,0.045)_0_1px,transparent_1px_8px)]" />
                )}
                {t.kind === 'plain' && <span className="absolute inset-0 bg-[#FAFAFA]" />}
                {t.kind === 'clip' && (
                  <>
                    <span className="absolute inset-0 bg-[#FAFAFA]" />
                    <span className="absolute inset-x-0 bottom-0 h-0.75 bg-[#F4F4F5]">
                      <span className="block h-full w-1/3 bg-[#D4D4D8]" />
                    </span>
                    <svg
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#D4D4D8]"
                      width="18" height="18" viewBox="0 0 24 24" fill="none"
                    >
                      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                    </svg>
                  </>
                )}
              </figure>
            ))}
          </motion.div>
        ))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-225 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.6)_45%,transparent_72%)]"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-[0.035] mix-blend-multiply"
      >
        <filter id="dp-grain-signup">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dp-grain-signup)" />
      </svg>
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: calm ? 0 : 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10"
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-[#171717]">
            <rect x="1.85" y="1.85" width="12.3" height="12.3" rx="3.7" stroke="currentColor" strokeWidth="1.5" />
            <rect
              x="5.35" y="5.35" width="5.3" height="5.3" rx="1.2"
              fill="currentColor" transform="rotate(45 8 8)"
              className="origin-center transition-transform duration-500 ease-out group-hover:rotate-90"
            />
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">{BRAND}</span>
        </Link>
        <Link
          href={signinHref}
          className="rounded-full border border-[#EAEAEA] bg-white/70 px-3 py-1.5 text-[12px] font-medium text-[#666] backdrop-blur-md transition hover:border-[#D4D4D4] hover:text-[#171717]"
        >
          Se connecter
        </Link>
      </motion.header>
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: calm ? 0 : 0.55, ease: EASE }}
          className="w-full max-w-116 rounded-2xl border border-[#EAEAEA] bg-white/85 p-7 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_28px_64px_-32px_rgba(9,9,11,0.22)] backdrop-blur-xl sm:p-9"
        >
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: calm ? 0 : 0.45, ease: EASE }}
                className="py-2"
              >
                <span className="grid size-11 place-items-center rounded-xl border border-[#EAEAEA] bg-[#FAFAFA]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#171717" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h1 className="mt-5 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                  Compte créé.
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
                  Bienvenue {firstname.trim()}. Ton adresse publique est réservée.
                </p>
                <div className="mt-4 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-2.5">
                  <p className="font-mono text-[13px] text-[#171717]">
                    {SITE.replace('https://', '')}/@{username}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#8F8F8F]">
                    Elle sera visible dès ta première galerie publiée.
                  </p>
                </div>
                <Link
                  href={signinHref}
                  className="mt-7 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#171717] text-[14px] font-medium text-white transition hover:bg-[#383838]"
                >
                  Se connecter
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={false}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: calm ? 0 : 0.25, ease: EASE }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                  Inscription 4 étapes
                </p>
                <h1 className="mt-2.5 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                  Ouvre ton espace.
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
                  Une bibliothèque privée, et une adresse publique à ton nom.
                </p>
                <div className="mt-7 flex gap-5">
                  <div className="relative flex shrink-0 flex-col justify-between pb-1 pt-1">
                    <span aria-hidden className="absolute bottom-3 left-2.75 top-3 w-px bg-[#EAEAEA]" />
                    <motion.span
                      aria-hidden
                      className="absolute left-2.75 top-3 w-px origin-top bg-[#171717]"
                      initial={false}
                      animate={{ height: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
                      transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32 }}
                      style={{ maxHeight: 'calc(100% - 24px)' }}
                    />
                    {STEPS.map((name, i) => {
                      const idx = (i + 1) as Step;
                      const current = step === idx;
                      const passedStep = step > idx;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => !loading && idx < step && goTo(idx)}
                          disabled={idx >= step || loading}
                          className="group relative flex items-center gap-2.5 text-left disabled:cursor-default"
                        >
                          <span
                            className={`grid size-5.75 shrink-0 place-items-center rounded-full border text-[10px] font-medium transition-colors duration-300 ${current
                              ? 'border-[#171717] bg-[#171717] text-white'
                              : passedStep
                                ? 'border-[#171717] bg-white text-[#171717]'
                                : 'border-[#EAEAEA] bg-white text-[#A1A1A1]'
                              }`}
                          >
                            {passedStep ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              idx
                            )}
                          </span>
                          <span
                            className={`hidden text-[12px] transition-colors sm:block ${current
                              ? 'font-medium text-[#171717]'
                              : passedStep
                                ? 'text-[#666] group-hover:text-[#171717]'
                                : 'text-[#A1A1A1]'
                              }`}
                          >
                            {name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span aria-hidden className="w-px shrink-0 bg-[#EAEAEA]" />
                  <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="min-w-0 flex-1" noValidate>
                    <span className="sr-only" role="status">
                      Étape {step} sur 4 · {STEPS[step - 1]}
                    </span>
                    <AnimatePresence mode="wait" initial={false} custom={dir}>
                      <motion.div
                        key={step}
                        custom={dir}
                        variants={SWAP}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: calm ? 0 : 0.22, ease: EASE }}
                      >
                        {step === 1 && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor="firstname" className="mb-2 block text-[13px] font-medium text-[#171717]">
                                Prénom
                              </label>
                              <input
                                ref={firstnameRef}
                                id="firstname"
                                name="firstname"
                                type="text"
                                autoComplete="given-name"
                                maxLength={30}
                                placeholder="Marie"
                                disabled={loading}
                                value={firstname}
                                onChange={(e) => setFirstname(e.target.value)}
                                className={`${FIELD} ${error ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                              />
                            </div>
                            <div>
                              <label htmlFor="lastname" className="mb-2 block text-[13px] font-medium text-[#171717]">
                                Nom
                              </label>
                              <input
                                id="lastname"
                                name="lastname"
                                type="text"
                                autoComplete="family-name"
                                maxLength={30}
                                placeholder="Curie"
                                disabled={loading}
                                value={lastname}
                                onChange={(e) => setLastname(e.target.value)}
                                className={`${FIELD} ${error ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                              />
                            </div>
                          </div>
                        )}
                        {step === 2 && (
                          <div>
                            <label htmlFor="username" className="mb-2 block text-[13px] font-medium text-[#171717]">
                              Identifiant public
                            </label>
                            <div className="flex items-center">
                              <span className="flex h-10 shrink-0 items-center rounded-l-lg border border-r-0 border-[#EAEAEA] bg-[#FAFAFA] px-2.5 font-mono text-[12px] text-[#8F8F8F]">
                                dropicture.com/@
                              </span>
                              <div className="relative min-w-0 flex-1">
                                <input
                                  ref={usernameRef}
                                  id="username"
                                  name="username"
                                  type="text"
                                  autoComplete="username"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  maxLength={30}
                                  placeholder="marie.curie"
                                  disabled={loading}
                                  value={username}
                                  onChange={(e) =>
                                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))
                                  }
                                  className={`${FIELD} rounded-l-none pr-9 font-mono ${error || availability === 'taken' ? 'border-[#E5484D]' : 'border-[#EAEAEA]'
                                    }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                  {availability === 'checking' && (
                                    <motion.span
                                      aria-hidden
                                      className="block size-3.5 rounded-full border-2 border-[#EAEAEA] border-t-[#A1A1A1]"
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                                    />
                                  )}
                                  {availability === 'free' && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#171717]">
                                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                  {availability === 'taken' && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[#E5484D]">
                                      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                                    </svg>
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 text-[12px] leading-5 text-[#8F8F8F]">
                              {availability === 'taken'
                                ? 'Cet identifiant est déjà pris.'
                                : availability === 'free'
                                  ? 'Disponible.'
                                  : 'Minuscules, chiffres, points et tirets bas. Modifiable plus tard, mais les liens déjà partagés cesseront de fonctionner.'}
                            </p>
                          </div>
                        )}
                        {step === 3 && (
                          <div>
                            <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-[#171717]">
                              E-mail
                            </label>
                            <input
                              ref={emailRef}
                              id="email"
                              name="email"
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              spellCheck={false}
                              placeholder="toi@dropicture.com"
                              disabled={loading}
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className={`${FIELD} ${error ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                            />
                            <p className="mt-2 text-[12px] leading-5 text-[#8F8F8F]">
                              Jamais affiché publiquement. Pas de newsletter, pas de tracking.
                            </p>
                          </div>
                        )}
                        {step === 4 && (
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <label htmlFor="password" className="text-[13px] font-medium text-[#171717]">
                                Mot de passe
                              </label>
                              <button
                                type="button"
                                onClick={() => setReveal((v) => !v)}
                                className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                              >
                                {reveal ? 'Masquer' : 'Afficher'}
                              </button>
                            </div>
                            <input
                              ref={passwordRef}
                              id="password"
                              name="password"
                              type={reveal ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="••••••••••••"
                              disabled={loading}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`${FIELD} ${error ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                            />
                            <input
                              type="text"
                              name="username"
                              autoComplete="username"
                              value={username}
                              readOnly
                              hidden
                              aria-hidden
                              tabIndex={-1}
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
                                const ok = r.test(password);
                                return (
                                  <li
                                    key={r.id}
                                    className={`flex items-center gap-1.5 text-[12px] transition-colors ${ok ? 'text-[#171717]' : 'text-[#A1A1A1]'}`}
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
                        )}
                      </motion.div>
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {error && (
                        <motion.p
                          key={error}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                          role="alert"
                          className="flex items-start gap-1.5 overflow-hidden pt-3 text-[13px] leading-5 text-[#E5484D]"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.75 shrink-0">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                            <path d="M12 7.5v5.5M12 16.2v.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <div className="mt-5 flex items-center gap-2">
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={back}
                          disabled={loading}
                          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white/60 pl-2.5 pr-3 text-[13px] text-[#666] transition hover:border-[#D4D4D4] hover:text-[#171717] disabled:opacity-60"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className={KBD}>esc</span>
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={!ready || loading}
                        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#171717] text-[14px] font-medium text-white transition hover:bg-[#383838] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/20 disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#A1A1A1]"
                      >
                        {loading && (
                          <motion.span
                            aria-hidden
                            className="size-3.5 rounded-full border-2 border-white/30 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                          />
                        )}
                        {loading ? 'Création…' : step < 4 ? 'Continuer' : 'Créer mon compte'}
                        {!loading && ready && (
                          <span className={`${KBD} ml-0.5 border-white/20 bg-white/10 text-white/70`}>↵</span>
                        )}
                      </button>
                    </div>
                    {step === 4 && (
                      <p className="mt-4 text-[12px] leading-5 text-[#8F8F8F]">
                        En créant un compte, tu acceptes les conditions d’utilisation et la politique
                        de confidentialité.
                      </p>
                    )}
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <footer className="relative z-10 px-6 pb-6 sm:px-10">
        <p className="text-center font-mono text-[11px] text-[#A1A1A1]">
          © {new Date().getFullYear()} {BRAND}
        </p>
      </footer>
    </main>
  );
}