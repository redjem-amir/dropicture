// dropicture/apps/saas/frontend/src/app/auth/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SITE = 'https://dropicture.com';
const API = process.env.NEXT_PUBLIC_API_URL ?? '';
const PAGE_SIZE = 40;

type Scope = 'all' | 'following';

type Author = {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  items: number;
  followers: number;
  following: boolean;
  avatar: { base: string; srcSet: { avif: string; webp: string } | null } | null;
};

type Pin = {
  key: string;
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  gallery: { id: string; title: string; slug: string; tags: string[] };
  author: Author | null;
  base: string;
  srcSet: { avif: string; webp: string } | null;
  poster: string | null;
};

type TagRow = { tag: string | null; label: string; total: number };
type Me = {
  galleries: number;
  publishedGalleries: number;
  publishedMedia: number;
  following: number;
  followers: number;
};

const clip = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.code ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

function Avatar({ author, big }: { author: Author; big?: boolean }) {
  const box = big ? 'size-9 shrink-0 text-[11px]' : 'size-5 shrink-0 text-[8px]';
  if (author.avatar) {
    return (
      <img
        src={`${author.avatar.base}/160.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${box} rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${box} grid place-items-center rounded-full bg-[#171717] font-mono font-medium text-white`}
    >
      {author.username.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Page() {
  const calm = useReducedMotion() === true;

  const [scope, setScope] = useState<Scope>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [tags, setTags] = useState<TagRow[]>([{ tag: null, label: 'Tout', total: 0 }]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    api<{ tags: TagRow[] }>('/discover/tags').then((r) => setTags(r.tags)).catch(() => undefined);
    api<{ authors: Author[] }>('/discover/authors').then((r) => setAuthors(r.authors)).catch(() => undefined);
    api<Me>('/discover/me').then(setMe).catch(() => undefined);
  }, []);

  const query = useCallback(
    (next?: string) => {
      const params = new URLSearchParams({ scope, limit: String(PAGE_SIZE) });
      if (tag) params.set('tag', tag);
      if (next) params.set('cursor', next);
      return `/discover/feed?${params}`;
    },
    [scope, tag],
  );

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    api<{ items: Pin[]; nextCursor: string | null }>(query())
      .then((page) => {
        if (id !== requestId.current) return;
        setPins(page.items);
        setCursor(page.nextCursor);
      })
      .catch(() => id === requestId.current && setError('Le fil n’a pas pu être chargé.'))
      .finally(() => id === requestId.current && setLoading(false));
  }, [query]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    api<{ items: Pin[]; nextCursor: string | null }>(query(cursor))
      .then((page) => {
        if (id !== requestId.current) return;
        setPins((prev) => {
          const seen = new Set(prev.map((p) => p.key));
          return [...prev, ...page.items.filter((p) => !seen.has(p.key))];
        });
        setCursor(page.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [cursor, loadingMore, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: '800px' });
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  /** Optimiste : l'état bascule avant la réponse et revient en arrière si le
   *  serveur refuse. Suivre doit répondre à la vitesse du clic. */
  const toggleFollow = async (author: Author) => {
    const next = !author.following;
    const apply = (following: boolean) => {
      setAuthors((prev) => prev.map((a) => (a.id === author.id ? { ...a, following } : a)));
      setPins((prev) =>
        prev.map((p) => (p.author?.id === author.id ? { ...p, author: { ...p.author, following } } : p)),
      );
    };
    apply(next);
    try {
      await api(`/discover/follows/${encodeURIComponent(author.username)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      setMe((m) => (m ? { ...m, following: m.following + (next ? 1 : -1) } : m));
    } catch {
      apply(!next);
    }
  };

  const stage = { hidden: {}, show: { transition: { staggerChildren: calm ? 0 : 0.03 } } };
  const rise = {
    hidden: { opacity: calm ? 1 : 0, y: calm ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: calm ? 0 : 0.4, ease: EASE } },
  };

  const showcaseEmpty = me !== null && me.publishedGalleries === 0;

  return (
    <div className="relative h-full">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-96 bg-[repeating-linear-gradient(to_right,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px),repeating-linear-gradient(to_bottom,rgba(9,9,11,0.05)_0_1px,transparent_1px_72px)] mask-[radial-gradient(ellipse_80%_100%_at_50%_-10%,#000_30%,transparent_85%)]" />
      </div>

      <div className="relative h-full overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : 0.5, ease: EASE }}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Découvrir</p>
              <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                Ce que d’autres ont choisi de montrer
              </h1>
              <p className="mt-1 text-[14px] leading-relaxed text-[#666]">
                Uniquement des albums publiés. Rien de privé n’apparaît ici.
              </p>
            </div>

            <div className="flex items-center gap-0.5 rounded-lg border border-[#EAEAEA] bg-white p-0.5">
              {[
                { key: 'all' as const, label: 'Tout le monde' },
                { key: 'following' as const, label: 'Suivis' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  aria-pressed={scope === s.key}
                  className={`h-7 rounded-md px-2.5 text-[12px] font-medium transition ${scope === s.key ? 'bg-[#171717] text-white' : 'text-[#A1A1A1] hover:text-[#171717]'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.header>

          {authors.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: calm ? 0 : 0.5, delay: calm ? 0 : 0.05, ease: EASE }}
              className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {authors.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-[#EAEAEA] bg-white/85 px-4 py-3 backdrop-blur-xl"
                >
                  <Link href={`${SITE}/@${a.username}`} target="_blank" rel="noreferrer" className="shrink-0">
                    <Avatar author={a} big />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#171717]">{a.name}</p>
                    <p className="truncate text-[12px] text-[#8F8F8F]">
                      {a.bio || `${a.items} élément${a.items > 1 ? 's' : ''} publié${a.items > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(a)}
                    aria-pressed={a.following}
                    className={`h-8 shrink-0 rounded-lg border px-2.5 text-[12px] font-medium transition ${a.following
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#EAEAEA] bg-white text-[#171717] hover:border-[#D4D4D4]'
                      }`}
                  >
                    {a.following ? 'Suivi' : 'Suivre'}
                  </button>
                </div>
              ))}
            </motion.section>
          )}
          {tags.length > 1 && (
            <div className="-mx-1 mt-7 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
              {tags.map((t) => {
                const on = tag === t.tag;
                return (
                  <button
                    key={t.label + String(t.tag)}
                    type="button"
                    onClick={() => setTag(t.tag)}
                    aria-pressed={on}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition ${on
                      ? 'border-[#171717] bg-[#171717] text-white'
                      : 'border-[#EAEAEA] bg-white text-[#666] hover:border-[#D4D4D4] hover:text-[#171717]'
                      }`}
                  >
                    {t.label}
                    <span className={`ml-1.5 font-mono text-[10px] tabular-nums ${on ? 'text-white/60' : 'text-[#A1A1A1]'}`}>
                      {t.total}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mt-6 rounded-lg border border-[#FCE8E8] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#E5484D]">
              {error}
            </p>
          )}

          {loading && (
            <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
              {[64, 44, 56, 36, 52, 40, 60, 48, 44, 56].map((h, i) => (
                <div
                  key={i}
                  className="mb-4 animate-pulse break-inside-avoid rounded-xl bg-[#F4F4F5]"
                  style={{ height: `${h * 4}px` }}
                />
              ))}
            </div>
          )}

          {!loading && pins.length > 0 && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${scope}-${tag ?? 'all'}`}
                variants={stage}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: calm ? 0 : 0.12 } }}
                className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5"
              >
                {pins.map((p) => {
                  const ratio = p.width && p.height ? p.width / p.height : 3 / 4;
                  const src = p.kind === 'video' ? p.poster : `${p.base}/720.webp`;
                  return (
                    <motion.article key={p.key} variants={rise} className="group mb-4 break-inside-avoid">
                      <Link
                        href={`${SITE}/@${p.author?.username ?? ''}/${p.gallery.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition group-hover:border-[#D4D4D4]"
                      >
                        <div className="relative bg-[#FAFAFA]" style={{ aspectRatio: ratio }}>
                          {src && (
                            <picture>
                              {p.kind === 'image' && p.srcSet && (
                                <>
                                  <source type="image/avif" srcSet={p.srcSet.avif} sizes="(min-width:1280px) 18vw, (min-width:640px) 30vw, 45vw" />
                                  <source type="image/webp" srcSet={p.srcSet.webp} sizes="(min-width:1280px) 18vw, (min-width:640px) 30vw, 45vw" />
                                </>
                              )}
                              <img
                                src={src}
                                alt={p.gallery.title}
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                                className="absolute inset-0 size-full object-cover"
                              />
                            </picture>
                          )}

                          {p.kind === 'video' && (
                            <>
                              <svg
                                aria-hidden
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow"
                                width="26" height="26" viewBox="0 0 24 24" fill="none"
                              >
                                <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                                <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                              </svg>
                              {clip(p.durationMs) && (
                                <span className="absolute left-2 top-2 rounded-md bg-[#171717]/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white backdrop-blur">
                                  {clip(p.durationMs)}
                                </span>
                              )}
                            </>
                          )}

                          <span className="absolute inset-x-2 bottom-2 truncate rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#171717] opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
                            {p.gallery.title}
                          </span>
                        </div>
                      </Link>

                      {p.author && (
                        <div className="mt-2 flex items-center gap-2 px-0.5">
                          <Avatar author={p.author} />
                          <Link
                            href={`${SITE}/@${p.author.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-[12px] text-[#8F8F8F] transition group-hover:text-[#171717]"
                          >
                            {p.author.name}
                          </Link>
                        </div>
                      )}
                    </motion.article>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          <div ref={sentinel} aria-hidden className="h-px" />

          {loadingMore && (
            <p className="mt-6 text-center font-mono text-[11px] text-[#A1A1A1]">Chargement…</p>
          )}

          {!loading && pins.length === 0 && !error && (
            <div className="mt-6 rounded-xl border border-dashed border-[#EAEAEA] bg-white/60 px-6 py-14 text-center">
              <p className="text-[14px] text-[#666]">
                {scope === 'following'
                  ? 'Les comptes que tu suis n’ont encore rien publié.'
                  : tag
                    ? 'Aucun album sous ce tag pour l’instant.'
                    : 'Aucun album publié pour le moment.'}
              </p>
              {(tag || scope === 'following') && (
                <button
                  type="button"
                  onClick={() => {
                    setTag(null);
                    setScope('all');
                  }}
                  className="mt-4 inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
                >
                  Voir tout
                </button>
              )}
            </div>
          )}

          {showcaseEmpty && (
            <div className="mt-10 rounded-xl border border-[#EAEAEA] bg-white/85 px-6 py-8 text-center backdrop-blur-xl">
              <p className="text-[15px] font-medium tracking-[-0.02em] text-[#171717]">
                Ta vitrine est encore vide.
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#666]">
                {me && me.galleries > 0
                  ? 'Tu as déjà des albums : publies-en un pour qu’il apparaisse ici.'
                  : 'Regroupe des photos dans un album depuis ta bibliothèque, nomme-le comme tu veux, puis publie-le.'}
              </p>
              <Link
                href="/auth/library"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
              >
                {me && me.galleries > 0 ? 'Voir mes albums' : 'Créer un album'}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}