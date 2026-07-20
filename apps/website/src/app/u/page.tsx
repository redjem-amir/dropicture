// dropicture/apps/website/src/app/u/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_SAAS_BACKEND_URL;
const APP = process.env.NEXT_PUBLIC_SAAS_FRONTEND_URL;
const PAGE_SIZE = 48;

type MediaView = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

type Item = MediaView & { publishedAt: string | null };

type Page = { items: Item[]; nextCursor: string | null };

type Profile = {
  username: string;
  name: string;
  bio: string | null;
  avatar: MediaView | null;
  counts: { photos: number; followers: number };
  firstPublishedAt: string | null;
};

type Status = 'loading' | 'ready' | 'notfound' | 'error';

const ratio = (w: number | null, h: number | null) => (w && h ? `${w} / ${h}` : '3 / 4');

const clip = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null;

const dayLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

const CENTERED = 'mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6';
const HOME = 'mt-6 inline-flex h-9 items-center rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838]';
const POSTERS = new Map<string, string>();

function grabPoster(item: MediaView): Promise<string | null> {
  const cached = POSTERS.get(item.id);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const done = (value: string | null) => {
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.7);
        POSTERS.set(item.id, url);
        done(url);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
    video.src = `${item.url}#t=0.1`;
  });
}

function Thumb({ item, className, style }: { item: MediaView; className?: string; style?: React.CSSProperties }) {
  const [poster, setPoster] = useState<string | null>(
    item.kind === 'video' ? POSTERS.get(item.id) ?? null : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (item.kind !== 'video' || poster || failed) return;
    let alive = true;
    void grabPoster(item).then((url) => {
      if (!alive) return;
      if (url) setPoster(url);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [item, poster, failed]);

  if (item.kind === 'image') {
    return <img src={item.url} alt="" loading="lazy" decoding="async" className={className} style={style} />;
  }
  if (poster) {
    return <img src={poster} alt="" decoding="async" className={className} style={style} />;
  }
  return (
    <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline className={className} style={style} />
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-[#F4F4F5]" />
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-[#F4F4F5]" />
          <div className="h-3 w-24 animate-pulse rounded bg-[#F4F4F5]" />
        </div>
      </div>
      <div className="mt-12 columns-2 gap-4 sm:columns-3 lg:columns-4 *:mb-4">
        {[56, 40, 64, 44, 52, 36, 60, 48].map((h, i) => (
          <div
            key={i}
            className="animate-pulse break-inside-avoid rounded-lg bg-[#F4F4F5]"
            style={{ height: `${h * 4}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function PublicProfile() {
  const username = (useSearchParams().get('u') ?? '').trim().replace(/^@/, '');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ user: string; status: 'ready' | 'notfound' | 'error' } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const status: Status = !username ? 'notfound' : loaded?.user === username ? loaded.status : 'loading';
  const open = viewer !== null ? items[viewer] ?? null : null;

  useEffect(() => {
    if (!username) return;
    const base = `${API}/api/public/${encodeURIComponent(username)}`;
    let cancelled = false;
    const settle = (s: 'ready' | 'notfound' | 'error') => setLoaded({ user: username, status: s });

    Promise.all([fetch(base), fetch(`${base}/media?limit=${PAGE_SIZE}`)])
      .then(async ([p, m]) => {
        if (cancelled) return;
        if (p.status === 404) return settle('notfound');
        if (!p.ok) return settle('error');
        const page: Page = m.ok ? await m.json() : { items: [], nextCursor: null };
        const account: Profile = await p.json();
        if (cancelled) return;
        setProfile(account);
        setItems(page.items);
        setCursor(page.nextCursor);
        settle('ready');
        document.title = `${account.name} (@${account.username}) · Dropicture`;
      })
      .catch(() => {
        if (!cancelled) settle('error');
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API}/api/public/${encodeURIComponent(username)}/media?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) return;
      const page: Page = await res.json();
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, username]);

  const goTo = useCallback(
    (next: number) => {
      if (!items.length) return;
      const idx = Math.max(0, Math.min(items.length - 1, next));
      setViewer(idx);
      if (idx >= items.length - 3) void loadMore();
    },
    [items.length, loadMore],
  );

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      if (e.key === 'ArrowRight') goTo(viewer + 1);
      if (e.key === 'ArrowLeft') goTo(viewer - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, goTo]);

  useEffect(() => {
    if (viewer === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [viewer]);

  if (status === 'loading') return <Skeleton />;

  if (status === 'notfound') {
    return (
      <div className={CENTERED}>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A1A1A1]">Erreur 404</p>
        <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">
          Ce profil n’existe pas
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
          {username ? (
            <>Aucun compte ne correspond à «&nbsp;{username}&nbsp;».</>
          ) : (
            <>
              Ajoute un nom d’utilisateur à l’adresse, par exemple <code>/u/?u=lena</code>.
            </>
          )}
        </p>
        <Link href="/" className={HOME}>
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <div className={CENTERED}>
        <h1 className="text-[18px] font-semibold text-[#171717]">Impossible de charger ce profil</h1>
        <p className="mt-2 text-[14px] text-[#666]">Réessaie dans un instant.</p>
        <Link href="/" className={HOME}>
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  const since = monthYear(profile.firstPublishedAt);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#EAEAEA] bg-[#F4F4F5]">
            {profile.avatar ? (
              <img
                src={profile.avatar.url}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[24px] font-semibold text-[#A1A1A1]">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">
              {profile.name}
            </h1>
            <p className="font-mono text-[12px] text-[#A1A1A1]">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#666]">{profile.bio}</p>
            )}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#8F8F8F]">
              <span className="font-semibold text-[#171717]">
                {plural(profile.counts.photos, 'publication')}
              </span>
              <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
              <span>{plural(profile.counts.followers, 'abonné')}</span>
              {since && (
                <>
                  <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                  <span>depuis {since}</span>
                </>
              )}
            </p>
          </div>
          <Link
            href={`${APP}/signup`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
          >
            Suivre sur Dropicture
          </Link>
        </header>
        <section className="mt-12">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            En vitrine
          </h2>
          {items.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#8F8F8F]">
              Ce compte n’a encore rien mis en vitrine. Sa bibliothèque reste privée.
            </p>
          ) : (
            <div className="mt-4 columns-2 gap-4 sm:columns-3 lg:columns-4 *:mb-4">
              {items.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label="Agrandir"
                  className="group relative block w-full break-inside-avoid overflow-hidden rounded-lg border border-[#EAEAEA] bg-[#F4F4F5] transition hover:border-[#D4D4D4]"
                >
                  <Thumb
                    item={m}
                    className="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    style={{ aspectRatio: ratio(m.width, m.height) }}
                  />
                  {m.kind === 'video' && (
                    <>
                      <span className="pointer-events-none absolute inset-0 grid place-items-center">
                        <svg
                          width="30"
                          height="30"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                          className="text-white/90 drop-shadow"
                        >
                          <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                        </svg>
                      </span>
                      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
                        {clip(m.durationMs) ?? 'vidéo'}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
          {cursor && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-4 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA] disabled:opacity-50"
              >
                {loadingMore ? 'Chargement…' : 'Afficher plus'}
              </button>
            </div>
          )}
        </section>
      </div>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewer(null)}
          className="fixed inset-0 z-50 flex flex-col bg-[#09090B]/92 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white">{profile.name}</p>
              <p className="truncate font-mono text-[11px] text-white/60">
                @{profile.username}
                {dayLabel(open.publishedAt) ? ` · ${dayLabel(open.publishedAt)}` : ''}
              </p>
            </div>
            <p className="ml-auto hidden font-mono text-[11px] tabular-nums text-white/50 sm:block">
              {(viewer ?? 0) + 1} / {items.length}
            </p>
            <button
              type="button"
              onClick={() => setViewer(null)}
              aria-label="Fermer"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            <button
              type="button"
              disabled={viewer === 0}
              onClick={(e) => {
                e.stopPropagation();
                goTo((viewer ?? 0) - 1);
              }}
              aria-label="Précédent"
              className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open.kind === 'video' ? (
              <video
                key={open.id}
                src={open.url}
                controls
                autoPlay
                playsInline
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-xl"
              />
            ) : (
              <img
                key={open.id}
                src={open.url}
                alt=""
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            )}
            <button
              type="button"
              disabled={viewer === items.length - 1 && !cursor}
              onClick={(e) => {
                e.stopPropagation();
                goTo((viewer ?? 0) + 1);
              }}
              aria-label="Suivant"
              className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <PublicProfile />
    </Suspense>
  );
}