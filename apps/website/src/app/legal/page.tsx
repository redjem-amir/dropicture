// dropicture/apps/website/src/app/legal/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales · Dropicture',
  description: 'Éditeur, directeur de publication et hébergeurs du service Dropicture.',
};

const BLOCKS = [
  {
    title: 'Éditeur',
    rows: [
      ['Raison sociale', '[RAISON SOCIALE]'],
      ['Forme juridique', '[SAS / SARL / EI]'],
      ['Capital social', '[MONTANT] €'],
      ['Siège social', '[ADRESSE COMPLÈTE]'],
      ['RCS', '[VILLE] [SIREN]'],
      ['TVA intracommunautaire', 'FR[NUMÉRO]'],
      ['Contact', 'contact@dropicture.com'],
    ],
  },
  {
    title: 'Direction de la publication',
    rows: [
      ['Directeur de la publication', '[PRÉNOM NOM]'],
      ['Contact', 'contact@dropicture.com'],
    ],
  },
  {
    title: 'Hébergement application',
    rows: [
      ['Prestataire', 'Hetzner Online GmbH'],
      ['Adresse', 'Industriestr. 25, 91710 Gunzenhausen, Allemagne'],
      ['Localisation des serveurs', 'Falkenstein, Allemagne'],
    ],
  },
  {
    title: 'Hébergement fichiers et diffusion',
    rows: [
      ['Prestataire', 'Amazon Web Services EMEA SARL'],
      ['Adresse', '38 avenue John F. Kennedy, L-1855 Luxembourg'],
      ['Localisation du stockage', 'Paris, France (eu-west-3)'],
    ],
  },
];

export default function Page() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Légal</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.04em]">
          Mentions légales
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#666]">
          Informations requises par l’article 6 de la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l’économie numérique.
        </p>
        <div className="mt-10 space-y-6">
          {BLOCKS.map((b) => (
            <section key={b.title} className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
              <div className="border-b border-[#EAEAEA] bg-[#FAFAFA] px-5 py-3">
                <h2 className="text-[14px] font-semibold tracking-[-0.02em]">{b.title}</h2>
              </div>
              <dl className="divide-y divide-[#EAEAEA]">
                {b.rows.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3">
                    <dt className="w-48 shrink-0 font-mono text-[11px] uppercase tracking-widest text-[#A1A1A1]">
                      {k}
                    </dt>
                    <dd className="min-w-0 flex-1 text-[14px] text-[#171717]">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-tight">Propriété intellectuelle</h2>
          <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              La marque Dropicture, son identité visuelle et le code source du service sont
              protégés. Toute reproduction non autorisée est interdite.
            </p>
            <p className="text-[14px] leading-relaxed text-[#666]">
              Les contenus déposés par les utilisateurs demeurent leur propriété exclusive. Nous
              n’en revendiquons aucun droit.
            </p>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-[18px] font-semibold tracking-tight">Signalement de contenu</h2>
          <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              Pour signaler un contenu manifestement illicite hébergé sur le service, écris à{' '}
              <a href="mailto:abuse@dropicture.com" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
                abuse@dropicture.com
              </a>{' '}
              en précisant l’URL concernée, la nature du contenu et tes coordonnées.
            </p>
            <p className="text-[14px] leading-relaxed text-[#666]">
              Pour signaler une faille de sécurité, écris à{' '}
              <a href="mailto:security@dropicture.com" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
                security@dropicture.com
              </a>
              . Nous accusons réception sous 48 heures et ne poursuivons pas les recherches menées
              de bonne foi.
            </p>
          </div>
        </section>
        <div className="mt-14 flex flex-wrap gap-2">
          {[
            { href: '/terms', label: 'Conditions générales' },
            { href: '/privacy', label: 'Confidentialité' },
            { href: '/cookies', label: 'Cookies' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-[13px] text-[#171717] transition hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </article>
    </>
  );
}