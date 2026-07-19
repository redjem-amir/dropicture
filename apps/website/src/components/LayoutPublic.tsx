// dropicture/apps/website/src/components/LayoutPublic.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const APP = 'https://app.dropicture.com';
const CONSENT_KEY = 'dropicture.cookie-consent';

const NAV = [
  { label: 'Explorer', href: '/explore' },
  { label: 'Profils', href: '/profiles' },
  { label: 'Comment ça marche', href: '/#how' },
];

const FOOTER = [
  {
    title: 'Découvrir',
    links: [
      { label: 'Explorer', href: '/explore', external: false },
      { label: 'Profils', href: '/profiles', external: false },
      { label: 'Thèmes', href: '/topics', external: false },
    ],
  },
  {
    title: 'Compte',
    links: [
      { label: 'Se connecter', href: `${APP}/signin`, external: true },
      { label: 'Créer un compte', href: `${APP}/signup`, external: true },
      { label: 'Nous écrire', href: 'mailto:contact@dropicture.com', external: true },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Conditions générales', href: '/terms', external: false },
      { label: 'Confidentialité', href: '/privacy', external: false },
      { label: 'Cookies', href: '/cookies', external: false },
      { label: 'Mentions légales', href: '/legal', external: false },
    ],
  },
];

export default function LayoutPublic({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [consentAsked, setConsentAsked] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(CONSENT_KEY)) setConsentAsked(true);
    } catch {
      setConsentAsked(true);
    }
  }, []);

  const decide = (value: 'all' | 'essential') => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* navigation privée */
    }
    setConsentAsked(false);
  };

  const isActive = (href: string) => !href.includes('#') && pathname.startsWith(href);

  return (
    <div className="relative flex min-h-dvh flex-col bg-white font-sans text-[#171717] antialiased">
      <Link
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#171717] focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Aller au contenu
      </Link>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-180 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_85%_100%_at_50%_-5%,#000_25%,transparent_80%)]" />
        <div className="absolute inset-x-0 top-0 h-180 mask-[radial-gradient(ellipse_85%_100%_at_50%_-5%,#000_25%,transparent_80%)]">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(to_right,transparent_0_31.5px,#D4D4D8_31.5px_40.5px,transparent_40.5px_72px)] mask-[repeating-linear-gradient(to_bottom,transparent_0_36px,#000_36px_37px,transparent_37px_72px)]" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0_31.5px,#D4D4D8_31.5px_40.5px,transparent_40.5px_72px)] mask-[repeating-linear-gradient(to_right,transparent_0_36px,#000_36px_37px,transparent_37px_72px)]" />
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-[#EAEAEA] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
              className="shrink-0 text-[#171717]"
            >
              <rect x="1.85" y="1.85" width="12.3" height="12.3" rx="3.7" stroke="currentColor" strokeWidth="1.5" />
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
            <span className="hidden text-[14px] font-semibold tracking-[-0.02em] sm:block">
              Dropicture
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-0.5 md:flex">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-[13px] transition ${isActive(l.href)
                  ? 'bg-[#F4F4F5] font-medium text-[#171717]'
                  : 'text-[#666] hover:bg-[#FAFAFA] hover:text-[#171717]'
                  }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/explore"
            className="ml-auto flex h-9 min-w-0 max-w-72 flex-1 items-center gap-2 rounded-lg border border-[#EAEAEA] bg-[#FAFAFA] px-3 text-[13px] text-[#A1A1A1] transition hover:border-[#D4D4D4] hover:bg-white md:ml-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-left">Chercher une galerie, un profil</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`${APP}/signin`}
              className="hidden rounded-lg px-2.5 py-1.5 text-[13px] text-[#666] transition hover:bg-[#FAFAFA] hover:text-[#171717] sm:block"
            >
              Se connecter
            </Link>
            <Link
              href={`${APP}/signup`}
              className="inline-flex h-9 items-center rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838]"
            >
              Commencer
            </Link>
          </div>
        </div>
        <nav className="border-t border-[#EAEAEA] md:hidden">
          <div className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-none sm:px-6 [&::-webkit-scrollbar]:hidden">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                className={`shrink-0 rounded-full border px-3 py-1 text-[12px] transition ${isActive(l.href)
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#EAEAEA] bg-white text-[#666] hover:border-[#D4D4D4] hover:text-[#171717]'
                  }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main id="content" className="relative z-10 flex-1">
        {children}
      </main>
      <footer className="relative z-10 border-t border-[#EAEAEA] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="group flex items-center gap-2.5">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                  className="shrink-0 text-[#171717]"
                >
                  <rect x="1.85" y="1.85" width="12.3" height="12.3" rx="3.7" stroke="currentColor" strokeWidth="1.5" />
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
                <span className="text-[13px] font-semibold tracking-[-0.02em]">Dropicture</span>
              </div>
              <p className="mt-3 max-w-56 text-[13px] leading-relaxed text-[#8F8F8F]">
                Chacun garde sa bibliothèque privée et expose ce qu’il choisit.
              </p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[#A1A1A1]">
                Hébergé en Europe
              </p>
            </div>
            {FOOTER.map((col) => (
              <div key={col.title}>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                  {col.title}
                </h2>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) =>
                    l.external ? (
                      <li key={l.href}>
                        <Link href={l.href} className="text-[13px] text-[#666] transition hover:text-[#171717]">
                          {l.label}
                        </Link>
                      </li>
                    ) : (
                      <li key={l.href}>
                        <Link href={l.href} className="text-[13px] text-[#666] transition hover:text-[#171717]">
                          {l.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-[#EAEAEA] pt-6">
            <p className="font-mono text-[11px] text-[#A1A1A1]">
              © {new Date().getFullYear()} Dropicture
            </p>
            <p className="ml-auto font-mono text-[11px] text-[#D4D4D8]">
              Conçu et hébergé en France
            </p>
          </div>
        </div>
      </footer>
      {consentAsked && (
        <div role="dialog" aria-label="Préférences de cookies" className="fixed inset-x-0 bottom-0 z-50 p-4">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 rounded-xl border border-[#EAEAEA] bg-white/90 px-4 py-3.5 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_20px_48px_-20px_rgba(9,9,11,0.25)] backdrop-blur-xl">
            <p className="min-w-56 flex-1 text-[13px] leading-relaxed text-[#666]">
              Nous utilisons des cookies strictement nécessaires au fonctionnement du site, et des
              cookies de mesure d’audience si tu les acceptes.{' '}
              <Link
                href="/cookies"
                className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]"
              >
                En savoir plus
              </Link>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => decide('essential')}
                className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
              >
                Essentiels uniquement
              </button>
              <button
                type="button"
                onClick={() => decide('all')}
                className="inline-flex h-9 items-center rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838]"
              >
                Tout accepter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}