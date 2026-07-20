// dropicture/apps/website/src/app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const SAAS_BACKEND = process.env.NEXT_PUBLIC_SAAS_BACKEND_URL;
const SAAS_FRONTEND = process.env.NEXT_PUBLIC_SAAS_FRONTEND_URL;

type MediaView = {
  id: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

type Author = { username: string; name: string };

type Pin = MediaView & { author: Author | null };

type ProfileCard = {
  username: string;
  name: string;
  bio: string | null;
  avatar: MediaView | null;
  counts: { photos: number; followers: number };
  preview: MediaView[];
};

const ratio = (w: number | null, h: number | null) => (w && h ? `${w} / ${h}` : '3 / 4');

const clip = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const initials = (name: string, username: string) =>
  (name.trim().charAt(0) || username.charAt(0) || '?').toUpperCase();

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

const CTA =
  'inline-flex h-11 items-center gap-2 rounded-lg bg-[#171717] px-5 text-[14px] font-medium text-white transition hover:bg-[#383838]';

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${SAAS_BACKEND}/api/public${path}`);
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

function Thumb({ item, className }: { item: MediaView; className?: string }) {
  const style = { aspectRatio: ratio(item.width, item.height) };
  if (item.kind === 'video') {
    return (
      <video
        src={`${item.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className={className}
        style={style}
      />
    );
  }
  return <img src={item.url} alt="" loading="lazy" decoding="async" className={className} style={style} />;
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Page() {
  const [stats, setStats] = useState({ media: 0, authors: 0 });
  const [profiles, setProfiles] = useState<ProfileCard[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      get('/stats', { media: 0, authors: 0 }),
      get<{ profiles: ProfileCard[] }>('/profiles?limit=6', { profiles: [] }),
      get<{ items: Pin[] }>('/feed?limit=20', { items: [] }),
    ]).then(([s, p, f]) => {
      setStats(s);
      setProfiles(p.profiles);
      setPins(f.items);
      setLoaded(true);
    });
  }, []);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 lg:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            {stats.media > 0
              ? `${stats.media} publications · ${plural(stats.authors, 'compte')}`
              : 'Bibliothèque privée, vitrine publique'}
          </p>
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[50px]">
            Ce que d’autres ont choisi de montrer.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-[#666]">
            Chacun garde ici sa bibliothèque privée. Ce que tu vois ci-dessous, ce sont les images
            que leurs auteurs ont décidé d’exposer et rien d’autre.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link href={`${SAAS_FRONTEND}/signup`} className={CTA}>
              Créer ta vitrine
              <Arrow />
            </Link>
            <Link
              href="#explore"
              className="inline-flex h-11 items-center rounded-lg border border-[#EAEAEA] bg-white px-5 text-[14px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
            >
              Explorer
            </Link>
          </div>
        </div>
      </section>
      {profiles.length > 0 && (
        <section id="profiles" className="scroll-mt-20 border-y border-[#EAEAEA] bg-[#FAFAFA]/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Profils</p>
            <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
              Celles et ceux qui publient.
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((p) => (
                <Link
                  key={p.username}
                  href={`/u/?u=${encodeURIComponent(p.username)}`}
                  className="group overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition hover:border-[#D4D4D4]"
                >
                  <div className="grid h-32 grid-cols-3 gap-px overflow-hidden bg-[#EAEAEA]">
                    <div className="col-span-2 bg-[#F4F4F5]">
                      {p.preview[0] && <Thumb item={p.preview[0]} className="h-full w-full object-cover" />}
                    </div>
                    <div className="grid grid-rows-2 gap-px">
                      <div className="bg-[#F4F4F5]">
                        {p.preview[1] && <Thumb item={p.preview[1]} className="h-full w-full object-cover" />}
                      </div>
                      <div className="bg-[#F4F4F5]">
                        {p.preview[2] && <Thumb item={p.preview[2]} className="h-full w-full object-cover" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    {p.avatar ? (
                      <img
                        src={p.avatar.url}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[11px] font-medium text-white"
                      >
                        {initials(p.name, p.username)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-[#171717]">
                        {p.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[#8F8F8F]">@{p.username}</p>
                      {p.bio && <p className="mt-1.5 truncate text-[13px] text-[#666]">{p.bio}</p>}
                      <p className="mt-2 flex items-center gap-2 font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                        <span>{p.counts.photos} en vitrine</span>
                        <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                        <span>{plural(p.counts.followers, 'abonné')}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <section id="explore" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Explorer</p>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
            Publié récemment.
          </h2>
        </div>
        {!loaded && (
          <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
            {[56, 40, 64, 44, 52, 36, 60, 48, 44, 58].map((h, i) => (
              <div
                key={i}
                className="mb-4 animate-pulse break-inside-avoid rounded-xl bg-[#F4F4F5]"
                style={{ height: `${h * 4}px` }}
              />
            ))}
          </div>
        )}
        {loaded && pins.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-[#EAEAEA] bg-white px-6 py-16 text-center">
            <p className="text-[15px] font-medium text-[#171717]">Les premières vitrines arrivent.</p>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#666]">
              Rien n’a encore été publié. Crée ton compte et cette page commencera avec tes images.
            </p>
            <Link
              href={`${SAAS_FRONTEND}/signup`}
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#171717] px-4 text-[13px] font-medium text-white transition hover:bg-[#383838]"
            >
              Créer ta vitrine
            </Link>
          </div>
        )}
        {pins.length > 0 && (
          <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
            {pins.map((pin) => (
              <article key={pin.id} className="group mb-4 break-inside-avoid">
                <Link
                  href={`/u/?u=${encodeURIComponent(pin.author?.username ?? '')}`}
                  className="relative block overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#F4F4F5] transition group-hover:border-[#D4D4D4]"
                >
                  <Thumb item={pin} className="w-full object-cover" />
                  {pin.kind === 'video' && (
                    <>
                      <svg
                        aria-hidden
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow"
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                      </svg>
                      {clip(pin.durationMs) && (
                        <span className="absolute left-2 top-2 rounded-md bg-[#171717]/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white backdrop-blur">
                          {clip(pin.durationMs)}
                        </span>
                      )}
                    </>
                  )}
                </Link>
                {pin.author && (
                  <Link
                    href={`/u/?u=${encodeURIComponent(pin.author.username)}`}
                    className="mt-2 flex items-center gap-2 px-0.5"
                  >
                    <span
                      aria-hidden
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[8px] font-medium text-white"
                    >
                      {initials(pin.author.name, pin.author.username)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[#8F8F8F] transition group-hover:text-[#171717]">
                      {pin.author.name}
                    </span>
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 border-t border-[#EAEAEA] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            Comment ça marche
          </p>
          <h2 className="mt-4 text-[30px] font-semibold leading-[1.15] tracking-[-0.035em]">
            Une bibliothèque privée. Une vitrine que tu choisis.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#666]">
            Ce que tu vois sur cette page ne représente qu’une fraction de ce que ces auteurs
            stockent chez nous. Le reste ne sortira jamais de leur espace privé.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#EAEAEA] lg:grid-cols-3">
          {[
            {
              n: '01',
              title: 'Dépose',
              body: 'Glisse tes photos et tes vidéos. Elles arrivent en privé, rangées par mois, visibles de toi seul.',
            },
            {
              n: '02',
              title: 'Range',
              body: 'Regroupe-les en albums pour t’y retrouver. Un album est un classement privé, jamais une page publique.',
            },
            {
              n: '03',
              title: 'Publie',
              body: 'Choisis une image et mets-la en vitrine : elle apparaît sur ton profil. Retire-la, elle disparaît aussitôt.',
            },
          ].map((s) => (
            <div key={s.n} className="bg-white p-6">
              <span className="font-mono text-[11px] tabular-nums text-[#A1A1A1]">{s.n}</span>
              <h3 className="mt-3 text-[18px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[#666]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="security" className="scroll-mt-20 border-t border-[#EAEAEA] bg-[#FAFAFA]/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                Sécurité
              </p>
              <h2 className="mt-4 text-[30px] font-semibold leading-[1.15] tracking-[-0.035em]">
                Ce que nous ne faisons pas.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#666]">
                La plupart des engagements de confidentialité décrivent des protections. Les nôtres
                décrivent surtout des choses que nous nous interdisons.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-2">
              {[
                { t: 'Pas de publicité', d: 'Aucune régie, aucun pixel de suivi tiers, aucun profilage publicitaire.' },
                { t: 'Pas d’entraînement', d: 'Les fichiers ne servent à entraîner aucun modèle, ni le nôtre ni celui d’un tiers.' },
                { t: 'Pas de sortie d’Europe', d: 'Stockage et traitement en Union européenne, sous droit européen.' },
                { t: 'Pas de verrouillage', d: 'Export complet en un clic, formats ouverts, aucune dépendance à notre format.' },
              ].map((i) => (
                <div key={i.t} className="bg-white p-5">
                  <dt className="text-[14px] font-medium tracking-[-0.01em]">{i.t}</dt>
                  <dd className="mt-1.5 text-[13px] leading-relaxed text-[#666]">{i.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-[#EAEAEA] bg-white px-6 py-14 text-center">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.04em]">
            Ta vitrine t’attend.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#666]">
            Dépose tes premières photos, garde-les pour toi, et publie-les le jour où tu le décides.
          </p>
          <Link href={`${SAAS_FRONTEND}/signup`} className={`${CTA} mt-7`}>
            Créer ta vitrine
            <Arrow />
          </Link>
        </div>
      </section>
    </>
  );
}