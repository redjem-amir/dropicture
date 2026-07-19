// dropicture/apps/website/src/app/privacy/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confidentialité · Dropicture',
  description:
    'Quelles données Dropicture collecte, pourquoi, combien de temps, et comment exercer tes droits.',
};

const UPDATED = '18 juillet 2026';

const DATA = [
  { what: 'Identité', detail: 'Prénom, nom, adresse électronique', why: 'Créer et gérer ton compte', basis: 'Exécution du contrat', kept: 'Durée du compte + 30 j' },
  { what: 'Authentification', detail: 'Mot de passe haché (Argon2id), jetons de session', why: 'Sécuriser l’accès', basis: 'Exécution du contrat', kept: 'Session : 8 h' },
  { what: 'Contenus', detail: 'Photos, vidéos, métadonnées techniques (EXIF)', why: 'Fournir le service de stockage', basis: 'Exécution du contrat', kept: 'Jusqu’à suppression + 30 j' },
  { what: 'Usage', detail: 'Volume stocké, dates d’import, quotas', why: 'Facturer et appliquer les limites', basis: 'Exécution du contrat', kept: '3 ans' },
  { what: 'Journaux techniques', detail: 'Adresse IP, agent utilisateur, horodatage', why: 'Sécurité, détection d’abus, débogage', basis: 'Intérêt légitime', kept: '12 mois' },
  { what: 'Facturation', detail: 'Historique des paiements, factures', why: 'Obligation comptable', basis: 'Obligation légale', kept: '10 ans' },
];

const RIGHTS = [
  { t: 'Accès', d: 'Obtenir une copie des données te concernant.' },
  { t: 'Rectification', d: 'Corriger une information inexacte depuis les réglages.' },
  { t: 'Effacement', d: 'Supprimer ton compte et tes contenus, en une action.' },
  { t: 'Portabilité', d: 'Exporter tes fichiers et métadonnées dans un format ouvert.' },
  { t: 'Opposition', d: 'T’opposer à un traitement fondé sur l’intérêt légitime.' },
  { t: 'Limitation', d: 'Demander le gel d’un traitement le temps d’une vérification.' },
];

export default function Page() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Légal</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.04em]">
          Politique de confidentialité
        </h1>
        <p className="mt-3 font-mono text-[11px] text-[#8F8F8F]">
          Dernière mise à jour : {UPDATED}
        </p>
        <p className="mt-8 text-[15px] leading-relaxed text-[#666]">
          Ce document décrit les données que nous traitons, la raison pour laquelle nous les
          traitons et la durée pendant laquelle nous les conservons. Il est rédigé pour être lu,
          pas pour être accepté sans être lu.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-3">
          {[
            { t: 'Aucune revente', d: 'Tes données ne sont ni vendues, ni louées, ni échangées.' },
            { t: 'Aucun entraînement', d: 'Tes fichiers n’entraînent aucun modèle, ni le nôtre ni celui d’un tiers.' },
            { t: 'Hébergement européen', d: 'Stockage et traitement en Union européenne.' },
          ].map((i) => (
            <div key={i.t} className="bg-white p-5">
              <p className="text-[14px] font-medium tracking-[-0.01em]">{i.t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#666]">{i.d}</p>
            </div>
          ))}
        </div>
        <section id="responsable" className="mt-12 scroll-mt-20">
          <h2 className="text-[18px] font-semibold tracking-tight">Responsable du traitement</h2>
          <div className="mt-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              [RAISON SOCIALE], [FORME JURIDIQUE] au capital de [MONTANT] €, immatriculée au RCS de
              [VILLE] sous le numéro [SIREN], dont le siège social est situé [ADRESSE].
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
              Contact :{' '}
              <a href="mailto:privacy@dropicture.com" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
                privacy@dropicture.com
              </a>
            </p>
          </div>
        </section>
        <section id="donnees" className="mt-12 scroll-mt-20">
          <h2 className="text-[18px] font-semibold tracking-tight">Données traitées</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#EAEAEA]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA]">
                    {['Catégorie', 'Finalité', 'Base légale', 'Conservation'].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#A1A1A1]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {DATA.map((d) => (
                    <tr key={d.what} className="align-top">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-[#171717]">{d.what}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[#8F8F8F]">{d.detail}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#666]">{d.why}</td>
                      <td className="px-4 py-3 text-[13px] text-[#666]">{d.basis}</td>
                      <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-[#666]">{d.kept}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-[#8F8F8F]">
            Les métadonnées EXIF, y compris les coordonnées de géolocalisation, sont conservées
            telles quelles dans tes originaux. Elles sont systématiquement retirées des versions
            publiées ou partagées par lien.
          </p>
        </section>
        <section id="sous-traitants" className="mt-12 scroll-mt-20">
          <h2 className="text-[18px] font-semibold tracking-tight">Sous-traitants</h2>
          <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              Nous faisons appel à un nombre restreint de prestataires, tous liés par un accord de
              sous-traitance conforme à l’article 28 du RGPD :
            </p>
            <ul className="space-y-2">
              {[
                { n: 'Hetzner Online GmbH', r: 'Serveurs applicatifs', l: 'Allemagne' },
                { n: 'Amazon Web Services EMEA', r: 'Stockage objet et distribution', l: 'France (eu-west-3)' },
                { n: 'Cloudflare Inc.', r: 'Réseau de diffusion et protection', l: 'UE — clauses contractuelles types' },
                { n: '[PRESTATAIRE PAIEMENT]', r: 'Traitement des paiements', l: '[PAYS]' },
              ].map((s) => (
                <li key={s.n} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <span className="font-medium text-[#171717]">{s.n}</span>
                  <span className="text-[#666]">— {s.r}</span>
                  <span className="font-mono text-[11px] text-[#A1A1A1]">{s.l}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section id="droits" className="mt-12 scroll-mt-20">
          <h2 className="text-[18px] font-semibold tracking-tight">Tes droits</h2>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[#EAEAEA] bg-[#EAEAEA] sm:grid-cols-2">
            {RIGHTS.map((r) => (
              <div key={r.t} className="bg-white p-4">
                <p className="text-[13px] font-medium tracking-[-0.01em]">{r.t}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#666]">{r.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-[#666]">
            La plupart de ces droits s’exercent directement depuis les réglages de ton compte. Pour
            les autres, écris à{' '}
            <a href="mailto:privacy@dropicture.com" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
              privacy@dropicture.com
            </a>
            . Nous répondons sous un mois.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#666]">
            En cas de désaccord, tu peux introduire une réclamation auprès de la CNIL,{' '}
            <span className="font-mono text-[13px]">cnil.fr</span>.
          </p>
        </section>
        <section id="securite" className="mt-12 scroll-mt-20">
          <h2 className="text-[18px] font-semibold tracking-tight">Mesures de sécurité</h2>
          <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
            <p className="text-[14px] leading-relaxed text-[#666]">
              Chiffrement en transit (TLS 1.2 minimum) et au repos (AES-256). Mots de passe hachés
              avec Argon2id. Accès aux fichiers privés soumis à une signature à durée limitée liée
              au compte demandeur.
            </p>
            <p className="text-[14px] leading-relaxed text-[#666]">
              En cas de violation de données susceptible d’engendrer un risque pour tes droits,
              nous notifions la CNIL sous 72 heures et t’informons dans les meilleurs délais.
            </p>
          </div>
        </section>
        <div className="mt-14 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA]/60 p-5">
          <p className="text-[13px] leading-relaxed text-[#666]">
            Voir aussi notre{' '}
            <Link href="/cookies" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
              politique de cookies
            </Link>{' '}
            et nos{' '}
            <Link href="/terms" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
              conditions générales
            </Link>
            .
          </p>
        </div>
      </article>
    </>
  );
}