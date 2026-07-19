// dropicture/apps/website/src/app/cookies/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookies · Dropicture',
  description: 'Les cookies utilisés par Dropicture, leur finalité et leur durée de vie.',
};

const UPDATED = '18 juillet 2026';

const COOKIES = [
  { name: 'session', purpose: 'Maintenir ta session authentifiée', kind: 'Nécessaire', life: '8 heures', origin: 'Dropicture' },
  { name: 'CloudFront-Policy', purpose: 'Autoriser l’affichage de tes médias privés', kind: 'Nécessaire', life: '1 heure', origin: 'Dropicture' },
  { name: 'CloudFront-Signature', purpose: 'Signature associée à la règle d’accès', kind: 'Nécessaire', life: '1 heure', origin: 'Dropicture' },
  { name: 'CloudFront-Key-Pair-Id', purpose: 'Identifiant de la clé de signature', kind: 'Nécessaire', life: '1 heure', origin: 'Dropicture' },
  { name: 'dropicture.cookie-consent', purpose: 'Mémoriser ton choix sur cette bannière', kind: 'Nécessaire', life: '12 mois', origin: 'Dropicture' },
  { name: '_pa_*', purpose: 'Mesure d’audience agrégée, sans identifiant publicitaire', kind: 'Mesure', life: '13 mois', origin: 'Dropicture (auto-hébergé)' },
];

export default function Page() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Légal</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.04em]">
          Politique de cookies
        </h1>
        <p className="mt-3 font-mono text-[11px] text-[#8F8F8F]">
          Dernière mise à jour : {UPDATED}
        </p>
        <p className="mt-8 text-[15px] leading-relaxed text-[#666]">
          Un cookie est un petit fichier déposé sur ton appareil lors de la consultation d’un site.
          Nous en utilisons peu, et aucun à des fins publicitaires.
        </p>
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight">Deux catégories</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#171717] bg-white p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold tracking-[-0.02em]">Nécessaires</h3>
                <span className="rounded-md bg-[#171717] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white">
                  Toujours actifs
                </span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[#666]">
                Sans eux, tu ne peux ni rester connecté ni afficher tes propres médias. Ils ne
                requièrent pas de consentement et ne peuvent pas être désactivés.
              </p>
            </div>
            <div className="rounded-xl border border-[#EAEAEA] bg-white p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold tracking-[-0.02em]">Mesure d’audience</h3>
                <span className="rounded-md border border-[#EAEAEA] bg-[#FAFAFA] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#8F8F8F]">
                  Sur accord
                </span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[#666]">
                Statistiques agrégées de fréquentation, hébergées par nos soins. Aucune donnée
                n’est transmise à un tiers, aucun profil publicitaire n’est constitué.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-tight">Liste détaillée</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#EAEAEA]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-155 border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA]">
                    {['Nom', 'Finalité', 'Type', 'Durée'].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#A1A1A1]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {COOKIES.map((c) => (
                    <tr key={c.name} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-mono text-[12px] text-[#171717]">{c.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#A1A1A1]">{c.origin}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] leading-relaxed text-[#666]">{c.purpose}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                            c.kind === 'Nécessaire'
                              ? 'border-[#171717] bg-[#171717] text-white'
                              : 'border-[#EAEAEA] bg-[#FAFAFA] text-[#8F8F8F]'
                          }`}
                        >
                          {c.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-[#666]">{c.life}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-tight">Modifier ton choix</h2>
          <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              Ton choix est conservé douze mois. Pour le revoir, efface les données de site
              enregistrées par ton navigateur pour dropicture.com : la bannière réapparaîtra à ta
              prochaine visite.
            </p>
            <p className="text-[14px] leading-relaxed text-[#666]">
              Tu peux également configurer ton navigateur pour refuser tout cookie. Dans ce cas,
              l’accès à ton espace privé ne fonctionnera plus, les cookies de session étant
              indispensables à l’authentification.
            </p>
          </div>
        </section>
        <div className="mt-14 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA]/60 p-5">
          <p className="text-[13px] leading-relaxed text-[#666]">
            Pour le détail des traitements, consulte notre{' '}
            <Link href="/privacy" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </article>
    </>
  );
}