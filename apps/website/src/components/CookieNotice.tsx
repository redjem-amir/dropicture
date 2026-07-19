// dropicture/apps/website/src/components/CookieNotice.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'dropicture.cookie-consent';

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (value: 'all' | 'essential') => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* navigation privée */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Préférences de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 rounded-xl border border-[#EAEAEA] bg-white/90 px-4 py-3.5 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_20px_48px_-20px_rgba(9,9,11,0.25)] backdrop-blur-xl">
        <p className="min-w-56 flex-1 text-[13px] leading-relaxed text-[#666]">
          Nous utilisons des cookies strictement nécessaires au fonctionnement du site, et des
          cookies de mesure d’audience si tu les acceptes.{' '}
          <Link href="/cookies" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
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
  );
}