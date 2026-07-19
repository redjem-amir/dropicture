// dropicture/apps/website/src/components/PublicProfile.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.dropicture.com';
const APP = 'https://app.dropicture.com';

type SrcSet = { avif: string; webp: string } | null;

type MediaItem = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  base: string;
  srcSet: SrcSet;
  poster: string | null;
  thumbhash: string | null;
};

type GalleryCard = {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  total: number;
  publishedAt: string | null;
  cover: { id: string; kind: string; base: string; srcSet: SrcSet; poster: string | null } | null;
};

type Profile = {
  username: string;
  name: string;
  bio: string | null;
  avatar: { base: string; srcSet: SrcSet } | null;
  counts: { photos: number; galleries: number; followers: number };
  galleries: GalleryCard[];
};

function pickSrc(srcSet: SrcSet, base: string): string {
  if (!srcSet) return base;
  const parts = srcSet.webp.split(',').map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? last.split(' ')[0] : base;
}

function ratio(width: number | null, height: number | null): string {
  if (!width || !height) return '3 / 4';
  return `${width} / ${height}`;
}

function Thumb({
  item,
}: {
  item: Pick<MediaItem, 'kind' | 'base' | 'srcSet' | 'poster' | 'width' | 'height'>;
}) {
  const src = item.kind === 'video' ? item.poster ?? pickSrc(item.srcSet, item.base) : pickSrc(item.srcSet, item.base);
  return (
    <picture>
      {item.kind === 'image' && item.srcSet && (
        <>
          <source type="image/avif" srcSet={item.srcSet.avif} />
          <source type="image/webp" srcSet={item.srcSet.webp} />
        </>
      )}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{ aspectRatio: ratio(item.width, item.height) }}
      />
    </picture>
  );
}

export default function PublicProfile() {
  const params = useSearchParams();
  const raw = params.get('u') ?? '';
  const username = raw.trim().replace(/^@/, '');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!username) {
      setStatus('notfound');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setItems([]);
    setCursor(null);

    (async () => {
      try {
        const [pRes, mRes] = await Promise.all([
          fetch(`${API}/api/u/${encodeURIComponent(username)}`),
          fetch(`${API}/api/u/${encodeURIComponent(username)}/media?limit=48`),
        ]);
        if (cancelled) return;
        if (pRes.status === 404) {
          setStatus('notfound');
          return;
        }
        if (!pRes.ok) {
          setStatus('error');
          return;
        }
        const p = (await pRes.json()) as Profile;
        const m = mRes.ok ? ((await mRes.json()) as { items: MediaItem[]; nextCursor: string | null }) : { items: [], nextCursor: null };
        if (cancelled) return;
        setProfile(p);
        setItems(m.items);
        setCursor(m.nextCursor);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `${API}/api/u/${encodeURIComponent(username)}/media?limit=48&cursor=${encodeURIComponent(cursor)}`,
      );
      if (res.ok) {
        const m = (await res.json()) as { items: MediaItem[]; nextCursor: string | null };
        setItems((prev) => [...prev, ...m.items]);
        setCursor(m.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, username]);

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-[#F4F4F5]" />
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-[#F4F4F5]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[#F4F4F5]" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A1A1A1]">Erreur 404</p>
        <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">
          Ce profil n’existe pas
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
          {username ? (
            <>Aucun compte public ne correspond à «&nbsp;{username}&nbsp;».</>
          ) : (
            <>Aucun nom d’utilisateur n’a été fourni.</>
          )}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-[#171717] px-3 text-[13px] font-medium text-white transition hover:bg-[#383838]"
        >
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <h1 className="text-[18px] font-semibold text-[#171717]">Impossible de charger ce profil</h1>
        <p className="mt-2 text-[14px] text-[#666]">Réessayez dans un instant.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[#EAEAEA] bg-[#F4F4F5]">
          {profile.avatar ? (
            <Thumb
              item={{ kind: 'image', base: profile.avatar.base, srcSet: profile.avatar.srcSet, poster: null, width: 1, height: 1 }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[24px] font-semibold text-[#A1A1A1]">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">{profile.name}</h1>
          <p className="font-mono text-[12px] text-[#A1A1A1]">@{profile.username}</p>
          {profile.bio && <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#666]">{profile.bio}</p>}
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="font-semibold text-[#171717]">{profile.counts.photos}</dt>
              <dd className="text-[#8F8F8F]">photos</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-semibold text-[#171717]">{profile.counts.galleries}</dt>
              <dd className="text-[#8F8F8F]">galeries</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-semibold text-[#171717]">{profile.counts.followers}</dt>
              <dd className="text-[#8F8F8F]">abonnés</dd>
            </div>
          </dl>
        </div>
        <Link
          href={`${APP}/signup`}
          className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
        >
          Suivre sur Dropicture
        </Link>
      </header>
      {profile.galleries.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Galeries</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {profile.galleries.map((g) => (
              <article
                key={g.id}
                className="group overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition hover:border-[#D4D4D4]"
              >
                <div className="aspect-4/3 overflow-hidden bg-[#F4F4F5]">
                  {g.cover ? (
                    <Thumb
                      item={{
                        kind: g.cover.kind === 'video' ? 'video' : 'image',
                        base: g.cover.base,
                        srcSet: g.cover.srcSet,
                        poster: g.cover.poster,
                        width: 4,
                        height: 3,
                      }}
                    />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate text-[13px] font-medium text-[#171717]">{g.title}</h3>
                  <p className="mt-0.5 text-[12px] text-[#A1A1A1]">
                    {g.total} {g.total > 1 ? 'photos' : 'photo'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="mt-12">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Photos publiques</h2>
        {items.length === 0 ? (
          <p className="mt-4 text-[14px] text-[#8F8F8F]">
            Ce profil n’a pas encore rendu de photo publique.
          </p>
        ) : (
          <div className="mt-4 columns-2 gap-4 sm:columns-3 lg:columns-4 *:mb-4">
            {items.map((m) => (
              <div
                key={m.id}
                className="relative block overflow-hidden rounded-lg border border-[#EAEAEA] bg-[#F4F4F5] break-inside-avoid"
              >
                <Thumb item={m} />
                {m.kind === 'video' && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    vidéo
                  </span>
                )}
              </div>
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
  );
}
