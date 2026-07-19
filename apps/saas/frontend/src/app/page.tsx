// dropicture/apps/saas/frontend/src/app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useUser } from '@/components/UserProvider';
import { readSessionExpiredReason, clearReasonParam, SESSION_EXPIRED_REASONS, type SessionExpiredReason } from '@/lib/sessionExpiry';

const BRAND = 'Dropicture';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const NOTICE_COPY: Record<SessionExpiredReason, string> = {
  [SESSION_EXPIRED_REASONS.EXPIRED]: 'Session expirée. Reconnecte-toi pour reprendre.',
  [SESSION_EXPIRED_REASONS.REVOKED]: 'Session interrompue pour raison de sécurité.',
  [SESSION_EXPIRED_REASONS.SIGNED_OUT]: 'Déconnecté.',
};

type Tile = { h: string; kind: 'plain' | 'hatch' | 'clip' };

const COLUMNS: Tile[][] = [
  [{ h: 'h-54', kind: 'hatch' }, { h: 'h-36', kind: 'plain' }, { h: 'h-72', kind: 'clip' }],
  [{ h: 'h-36', kind: 'plain' }, { h: 'h-63', kind: 'clip' }, { h: 'h-45', kind: 'hatch' }],
  [{ h: 'h-72', kind: 'clip' }, { h: 'h-45', kind: 'hatch' }, { h: 'h-54', kind: 'plain' }],
  [{ h: 'h-45', kind: 'hatch' }, { h: 'h-72', kind: 'plain' }, { h: 'h-36', kind: 'clip' }],
  [{ h: 'h-63', kind: 'plain' }, { h: 'h-36', kind: 'hatch' }, { h: 'h-54', kind: 'clip' }],
  [{ h: 'h-36', kind: 'clip' }, { h: 'h-54', kind: 'plain' }, { h: 'h-63', kind: 'hatch' }],
];

const OFFSETS = ['mt-0', '-mt-18', '-mt-9', '-mt-27', '-mt-5', '-mt-14'];

const FADE =
  'mask-[radial-gradient(ellipse_90%_80%_at_50%_42%,#000_30%,transparent_100%)]';

const FIELD =
  'h-10 w-full rounded-lg border bg-white px-3 text-[14px] text-[#171717] outline-none transition placeholder:text-[#A1A1A1] focus:border-[#171717] focus:ring-4 focus:ring-[#171717]/8 disabled:bg-[#FAFAFA] disabled:text-[#8F8F8F]';

const KBD =
  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[#EAEAEA] bg-[#FAFAFA] px-1 font-mono text-[10px] leading-none text-[#8F8F8F]';

export default function Page() {
  const { login } = useUser();
  const calm = useReducedMotion() === true;

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SessionExpiredReason | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => (step === 1 ? emailRef : passwordRef).current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const reason = readSessionExpiredReason();
    if (reason) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(reason);
      clearReasonParam();
    }
  }, []);

  const back = () => {
    if (submitting || step === 1) return;
    setError(null);
    setPassword('');
    setReveal(false);
    setStep(1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Escape') back();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    if (step === 1) {
      const value = email.trim();
      if (!EMAIL_RE.test(value)) {
        setError('Adresse e-mail invalide.');
        return;
      }
      setEmail(value);
      setStep(2);
      return;
    }
    if (!password) return;
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (res && !res.ok) {
        const wrong = res.status === 401 || res.status === 403;
        setError(wrong ? 'Mot de passe incorrect.' : 'Connexion impossible. Réessaie dans un instant.');
        setSubmitting(false);
        if (wrong) {
          setPassword('');
          setReveal(false);
          passwordRef.current?.focus();
        }
      }
    } catch {
      setError('Le serveur ne répond pas. Vérifie ta connexion.');
      setSubmitting(false);
    }
  };

  const message = error ?? (notice ? NOTICE_COPY[notice] : null);
  const bad = Boolean(error);
  const ready = step === 1 ? email.trim().length > 0 : password.length > 0;

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
        className="pointer-events-none absolute inset-0 flex justify-center gap-4 px-4 mask-[radial-gradient(ellipse_54%_52%_at_50%_47%,transparent_45%,#000_92%),linear-gradient(to_bottom,transparent_0%,#000_16%,#000_74%,transparent_97%)] mask-intersect [-webkit-mask-composite:source-in]"
      >
        {COLUMNS.map((col, ci) => (
          <motion.div
            key={ci}
            className={`flex w-[clamp(112px,12.5vw,176px)] shrink-0 flex-col gap-4 ${OFFSETS[ci]}`}
            animate={calm ? undefined : { y: ['0%', '-50%'] }}
            transition={{ duration: 64 + ci * 8, repeat: Infinity, ease: 'linear' }}
          >
            {[...col, ...col].map((t, i) => (
              <figure
                key={`${ci}-${i}`}
                className={`relative shrink-0 overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white ${t.h}`}
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
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
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
        className="pointer-events-none absolute left-1/2 top-1/2 size-210 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0.6)_45%,transparent_72%)]"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-[0.035] mix-blend-multiply"
      >
        <filter id="dp-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dp-grain)" />
      </svg>
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: calm ? 0 : 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10"
      >
        <span className="group flex items-center gap-2.5">
          <svg
            width="26"
            height="26"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="shrink-0 text-[#171717]"
          >
            <rect
              x="1.85"
              y="1.85"
              width="12.3"
              height="12.3"
              rx="3.7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="5.35"
              y="5.35"
              width="5.3"
              height="5.3"
              rx="1.2"
              fill="currentColor"
              transform="rotate(45 8 8)"
              className="origin-center transition-transform duration-500 ease-out group-hover:rotate-90"
            />
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.02em]">{BRAND}</span>
        </span>
        <span className="hidden items-center gap-2 rounded-full border border-[#EAEAEA] bg-white/70 px-3 py-1.5 font-mono text-[11px] text-[#666] backdrop-blur-md sm:flex">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Privé par défaut
        </span>
      </motion.header>
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: calm ? 0 : 0.55, ease: EASE }}
          className="w-full max-w-100 rounded-2xl border border-[#EAEAEA] bg-white/85 p-7 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_28px_64px_-32px_rgba(9,9,11,0.22)] backdrop-blur-xl sm:p-9"
        >
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            Bibliothèque photo et vidéo
          </p>
          <h1 className="mt-4 text-center text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
            Content de te revoir.
          </h1>
          <p className="mt-2 text-center text-[14px] leading-relaxed text-[#666]">
            {step === 1
              ? 'Ta bibliothèque et ta vitrine t’attendent.'
              : 'Encore une étape avant tes fichiers.'}
          </p>
          <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="mt-7" noValidate>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor={step === 1 ? 'email' : 'password'}
                className="text-[13px] font-medium text-[#171717]"
              >
                {step === 1 ? 'E-mail' : 'Mot de passe'}
              </label>
              {step === 1 ? (
                <span className="font-mono text-[11px] tabular-nums text-[#A1A1A1]">1 / 2</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  className="text-[12px] text-[#8F8F8F] transition hover:text-[#171717]"
                >
                  {reveal ? 'Masquer' : 'Afficher'}
                </button>
              )}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: calm ? 0 : 0.24, ease: EASE }}
              >
                {step === 1 ? (
                  <input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="toi@dropicture.com"
                    aria-invalid={bad || undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${FIELD} ${bad ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                  />
                ) : (
                  <>
                    <input
                      ref={passwordRef}
                      id="password"
                      name="password"
                      type={reveal ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      aria-invalid={bad || undefined}
                      disabled={submitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${FIELD} ${bad ? 'border-[#E5484D]' : 'border-[#EAEAEA]'}`}
                    />
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={email}
                      readOnly
                      hidden
                      aria-hidden
                      tabIndex={-1}
                    />
                    <button
                      type="button"
                      onClick={back}
                      disabled={submitting}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA]/70 px-3 py-2 text-left transition hover:border-[#D4D4D4] disabled:opacity-60"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                        className="shrink-0 text-[#8F8F8F]"
                      >
                        <path
                          d="M15 6l-6 6 6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#666]">{email}</span>
                      <span className={KBD}>esc</span>
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {message && (
                <motion.p
                  key={message}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: calm ? 0 : 0.2, ease: EASE }}
                  role={bad ? 'alert' : 'status'}
                  className={`flex items-start gap-1.5 overflow-hidden pt-3 text-[13px] leading-5 ${bad ? 'text-[#E5484D]' : 'text-[#666]'
                    }`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="mt-0.75 shrink-0"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7.5v5.5M12 16.2v.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  {message}
                </motion.p>
              )}
            </AnimatePresence>
            <button
              type="submit"
              disabled={!ready || submitting}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#171717] text-[14px] font-medium text-white transition hover:bg-[#383838] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#171717]/20 disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#A1A1A1]"
            >
              {submitting && (
                <motion.span
                  aria-hidden
                  className="size-3.5 rounded-full border-2 border-white/30 border-t-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                />
              )}
              {submitting ? 'Connexion…' : step === 1 ? 'Continuer' : 'Se connecter'}
              {!submitting && ready && (
                <span className={`${KBD} ml-0.5 border-white/20 bg-white/10 text-white/70`}>↵</span>
              )}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#EAEAEA]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A1A1A1]">ou</span>
            <span className="h-px flex-1 bg-[#EAEAEA]" />
          </div>
          <Link
            href="/signup"
            className="flex h-10 w-full items-center justify-center rounded-lg border border-[#EAEAEA] bg-white/60 text-[14px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-white"
          >
            Créer un compte
          </Link>
          <p className="mt-5 text-center">
            <Link
              href="/reset-password"
              className="text-[13px] text-[#8F8F8F] underline decoration-[#EAEAEA] underline-offset-4 transition hover:text-[#171717] hover:decoration-[#171717]"
            >
              Mot de passe oublié ?
            </Link>
          </p>
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