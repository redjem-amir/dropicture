// dropicture/apps/website/src/app/page.tsx
import Link from 'next/link';

const APP = 'https://app.dropicture.com';

type Tone = 0 | 1 | 2;

const PROFILES = [
  { handle: 'lena.frames', name: 'Léna Marchal', bio: 'Architecture et lumière rasante', galleries: 6, items: 418, place: 'Lyon' },
  { handle: 'atlas.raw', name: 'Atlas Bonnet', bio: 'Paysages argentiques, moyen format', galleries: 4, items: 227, place: 'Grenoble' },
  { handle: 'mai.exposed', name: 'Maï Tran', bio: 'Nuit, néons, longues poses', galleries: 9, items: 613, place: 'Paris' },
  { handle: 'joon.still', name: 'Joon Park', bio: 'Natures mortes et textures', galleries: 3, items: 154, place: 'Bruxelles' },
  { handle: 'nour.px', name: 'Nour Ferhat', bio: 'Portraits en lumière naturelle', galleries: 5, items: 302, place: 'Marseille' },
];

const GALLERIES = [
  { handle: 'lena.frames', title: 'Escaliers', items: 42, tones: [2, 0, 1] as Tone[] },
  { handle: 'mai.exposed', title: 'Néons d’hiver', items: 88, tones: [1, 2, 0] as Tone[] },
  { handle: 'atlas.raw', title: 'Vercors, 6×7', items: 31, tones: [0, 1, 2] as Tone[] },
  { handle: 'nour.px', title: 'Fenêtre nord', items: 57, tones: [1, 0, 2] as Tone[] },
];

const PINS = [
  { id: 'p1', handle: 'lena.frames', gallery: 'Escaliers', h: 'h-72', tone: 2 as Tone, kind: 'photo' as const },
  { id: 'p2', handle: 'atlas.raw', gallery: 'Vercors, 6×7', h: 'h-45', tone: 0 as Tone, kind: 'photo' as const },
  { id: 'p3', handle: 'mai.exposed', gallery: 'Néons d’hiver', h: 'h-63', tone: 1 as Tone, kind: 'video' as const, clip: '0:12' },
  { id: 'p4', handle: 'joon.still', gallery: 'Sur la table', h: 'h-36', tone: 0 as Tone, kind: 'photo' as const },
  { id: 'p5', handle: 'nour.px', gallery: 'Fenêtre nord', h: 'h-54', tone: 1 as Tone, kind: 'photo' as const },
  { id: 'p6', handle: 'lena.frames', gallery: 'Escaliers', h: 'h-45', tone: 1 as Tone, kind: 'photo' as const },
  { id: 'p7', handle: 'mai.exposed', gallery: 'Néons d’hiver', h: 'h-72', tone: 2 as Tone, kind: 'photo' as const },
  { id: 'p8', handle: 'atlas.raw', gallery: 'Vercors, 6×7', h: 'h-36', tone: 1 as Tone, kind: 'photo' as const },
  { id: 'p9', handle: 'joon.still', gallery: 'Sur la table', h: 'h-63', tone: 2 as Tone, kind: 'video' as const, clip: '0:07' },
  { id: 'p10', handle: 'nour.px', gallery: 'Fenêtre nord', h: 'h-45', tone: 0 as Tone, kind: 'photo' as const },
  { id: 'p11', handle: 'lena.frames', gallery: 'Béton', h: 'h-54', tone: 2 as Tone, kind: 'photo' as const },
  { id: 'p12', handle: 'mai.exposed', gallery: 'Néons d’hiver', h: 'h-36', tone: 0 as Tone, kind: 'photo' as const },
  { id: 'p13', handle: 'atlas.raw', gallery: 'Brume', h: 'h-63', tone: 1 as Tone, kind: 'photo' as const },
  { id: 'p14', handle: 'joon.still', gallery: 'Sur la table', h: 'h-45', tone: 0 as Tone, kind: 'photo' as const },
  { id: 'p15', handle: 'nour.px', gallery: 'Contre-jour', h: 'h-72', tone: 1 as Tone, kind: 'photo' as const },
  { id: 'p16', handle: 'lena.frames', gallery: 'Béton', h: 'h-36', tone: 0 as Tone, kind: 'photo' as const },
];

const TOPICS = ['Architecture', 'Argentique', 'Nuit', 'Portrait', 'Nature', 'Textures', 'Voyage', 'Noir et blanc'];

const wire = (n: Tone) =>
  n === 0
    ? 'bg-[#FAFAFA]'
    : n === 1
      ? 'bg-[#F4F4F5]'
      : 'bg-[repeating-linear-gradient(45deg,rgba(9,9,11,0.045)_0_1px,transparent_1px_8px)]';

const initials = (handle: string) => handle.slice(0, 2).toUpperCase();

export default function Page() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 lg:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            Galeries publiées
          </p>
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[50px]">
            Ce que d’autres ont choisi de montrer.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-[#666]">
            Chacun garde ici sa bibliothèque privée. Ce que tu vois ci-dessous, ce sont les images
            que leurs auteurs ont décidé d’exposer — et rien d’autre.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href={`${APP}/signup`}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#171717] px-5 text-[14px] font-medium text-white transition hover:bg-[#383838]"
            >
              Créer ta galerie
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="#explore"
              className="inline-flex h-11 items-center rounded-lg border border-[#EAEAEA] bg-white px-5 text-[14px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
            >
              Explorer
            </Link>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-1.5">
          {TOPICS.map((t) => (
            <Link
              key={t}
              href={`/topics/${t.toLowerCase().replace(/\s+/g, '-')}`}
              className="rounded-full border border-[#EAEAEA] bg-white px-3 py-1.5 text-[12px] text-[#666] transition hover:border-[#171717] hover:text-[#171717]"
            >
              {t}
            </Link>
          ))}
        </div>
      </section>
      <section id="profiles" className="scroll-mt-20 border-y border-[#EAEAEA] bg-[#FAFAFA]/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
                Profils
              </p>
              <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
                Celles et ceux qui publient.
              </h2>
            </div>
            <Link
              href="/profiles"
              className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] font-medium text-[#171717] transition hover:border-[#D4D4D4]"
            >
              Voir tous les profils
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROFILES.slice(0, 3).map((p) => {
              const gallery = GALLERIES.find((g) => g.handle === p.handle);
              return (
                <Link
                  key={p.handle}
                  href={`/@${p.handle}`}
                  className="group overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition hover:border-[#D4D4D4]"
                >
                  <div className="grid h-32 grid-cols-3 gap-px bg-[#EAEAEA]">
                    <div className={`col-span-2 ${wire(gallery?.tones[0] ?? 0)}`} />
                    <div className="grid grid-rows-2 gap-px">
                      <div className={wire(gallery?.tones[1] ?? 1)} />
                      <div className={wire(gallery?.tones[2] ?? 2)} />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[11px] font-medium text-white"
                    >
                      {initials(p.handle)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-[#171717]">
                        {p.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[#8F8F8F]">@{p.handle}</p>
                      <p className="mt-1.5 truncate text-[13px] text-[#666]">{p.bio}</p>
                      <p className="mt-2 flex items-center gap-2 font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                        <span>{p.galleries} galeries</span>
                        <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                        <span>{p.items} éléments</span>
                        <span aria-hidden className="size-1 rounded-full bg-[#EAEAEA]" />
                        <span>{p.place}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section id="explore" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
              Explorer
            </p>
            <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
              Publié récemment.
            </h2>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-[#A1A1A1]">
            Mis à jour toutes les heures
          </p>
        </div>
        <div className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {PINS.map((pin) => {
            const author = PROFILES.find((p) => p.handle === pin.handle);
            return (
              <article key={pin.id} className="group mb-4 break-inside-avoid">
                <Link
                  href={`/@${pin.handle}`}
                  className="block overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition group-hover:border-[#D4D4D4]"
                >
                  <div className={`relative ${pin.h}`}>
                    <span className={`absolute inset-0 ${wire(pin.tone)}`} />
                    {pin.kind === 'video' && (
                      <>
                        <svg
                          aria-hidden
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#D4D4D8]"
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M10.4 8.8 15.6 12l-5.2 3.2V8.8Z" fill="currentColor" />
                        </svg>
                        <span className="absolute left-2 top-2 rounded-md bg-[#171717]/70 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white backdrop-blur">
                          {pin.clip}
                        </span>
                      </>
                    )}
                    <span className="absolute inset-x-2 bottom-2 truncate rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-[#171717] opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
                      {pin.gallery}
                    </span>
                  </div>
                </Link>
                <Link href={`/@${pin.handle}`} className="mt-2 flex items-center gap-2 px-0.5">
                  <span
                    aria-hidden
                    className="grid size-5 shrink-0 place-items-center rounded-full bg-[#171717] font-mono text-[8px] font-medium text-white"
                  >
                    {initials(pin.handle)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[#8F8F8F] transition group-hover:text-[#171717]">
                    {author?.name ?? pin.handle}
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/explore"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#EAEAEA] bg-white px-5 text-[14px] font-medium text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
          >
            Voir plus de galeries
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 9.5l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>
      <section className="border-y border-[#EAEAEA] bg-[#FAFAFA]/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            Galeries
          </p>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.035em]">
            Séries complètes.
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GALLERIES.map((g) => {
              const author = PROFILES.find((p) => p.handle === g.handle);
              return (
                <Link
                  key={`${g.handle}-${g.title}`}
                  href={`/@${g.handle}/${g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  className="group overflow-hidden rounded-xl border border-[#EAEAEA] bg-white transition hover:border-[#D4D4D4]"
                >
                  <div className="grid h-36 grid-cols-2 grid-rows-2 gap-px bg-[#EAEAEA]">
                    <div className={`row-span-2 ${wire(g.tones[0])}`} />
                    <div className={wire(g.tones[1])} />
                    <div className={wire(g.tones[2])} />
                  </div>
                  <div className="px-4 py-3">
                    <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-[#171717]">
                      {g.title}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-[#8F8F8F]">
                      {author?.name ?? g.handle}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] tabular-nums text-[#A1A1A1]">
                      {g.items} éléments
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
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
              body: 'Glisse tes photos et tes vidéos. Formats courants, RAW compris, originaux conservés tels quels.',
            },
            {
              n: '02',
              title: 'Garde',
              body: 'Tout arrive dans ton espace privé, rangé par mois et cherchable. Personne d’autre n’y accède.',
            },
            {
              n: '03',
              title: 'Montre',
              body: 'Bascule un album en public et il apparaît sur ton profil. Retire-le, il disparaît immédiatement.',
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
            Ta galerie t’attend.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#666]">
            Dépose ta première série, garde-la pour toi, et publie-la le jour où tu le décides.
            L’adresse est déjà réservée : dropicture.com/@toi.
          </p>
          <Link
            href={`${APP}/signup`}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-[#171717] px-5 text-[14px] font-medium text-white transition hover:bg-[#383838]"
          >
            Créer ta galerie
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}