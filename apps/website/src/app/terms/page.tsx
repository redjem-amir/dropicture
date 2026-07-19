// dropicture/apps/website/src/app/terms/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions générales · Dropicture',
  description: 'Conditions générales d’utilisation et de vente du service Dropicture.',
};

const UPDATED = '18 juillet 2026';

const SECTIONS = [
  {
    id: 'objet',
    title: 'Objet',
    body: [
      'Les présentes conditions régissent l’accès au service Dropicture et son utilisation. Créer un compte vaut acceptation sans réserve.',
      'Dropicture est un service d’hébergement, d’organisation et de partage de fichiers photo et vidéo, accessible par navigateur et par interface applicative.',
    ],
  },
  {
    id: 'compte',
    title: 'Compte utilisateur',
    body: [
      'La création d’un compte requiert une adresse électronique valide et un mot de passe respectant les exigences affichées à l’inscription. Tu es responsable de la confidentialité de tes identifiants et de toute activité effectuée depuis ton compte.',
      'Le service est réservé aux personnes âgées d’au moins 15 ans. En dessous de cet âge, le consentement d’un titulaire de l’autorité parentale est requis.',
      'Un compte inactif depuis vingt-quatre mois consécutifs peut être supprimé après notification par courrier électronique, avec un préavis de trente jours.',
    ],
  },
  {
    id: 'contenus',
    title: 'Contenus déposés',
    body: [
      'Tu conserves l’intégralité des droits sur les fichiers que tu déposes. Aucune cession de droits n’est consentie à Dropicture.',
      'Tu nous accordes uniquement la licence technique nécessaire à l’exécution du service : stocker, dupliquer aux fins de sauvegarde, transcoder pour produire les formats d’affichage, et transmettre aux destinataires que tu désignes. Cette licence prend fin à la suppression du contenu.',
      'Tu garantis disposer des droits nécessaires sur les contenus déposés et t’engages à ne pas héberger de contenus illicites, notamment ceux portant atteinte aux droits de tiers, aux mineurs ou à l’ordre public.',
    ],
  },
  {
    id: 'usage',
    title: 'Usage acceptable',
    body: [
      'Le service ne peut être utilisé pour distribuer des logiciels malveillants, contourner des mesures techniques de protection, ni comme réseau de diffusion pour un service tiers.',
      'Les quotas de stockage s’appliquent au volume réellement occupé après déduplication. Un usage manifestement disproportionné au regard d’un usage personnel normal peut faire l’objet d’une limitation, après information préalable.',
    ],
  },
  {
    id: 'partage',
    title: 'Partages et publication',
    body: [
      'Publier un album ou émettre un lien de partage relève de ta seule décision. Tu es responsable des conséquences d’une diffusion, y compris à l’égard des personnes figurant sur les contenus.',
      'La révocation d’un lien prend effet immédiatement sur nos serveurs. Nous ne pouvons en revanche garantir la suppression des copies déjà téléchargées par des tiers.',
    ],
  },
  {
    id: 'abonnement',
    title: 'Abonnement et paiement',
    body: [
      'Les plans payants sont facturés par avance, mensuellement ou annuellement selon l’option retenue. Le prélèvement s’effectue à la date anniversaire de la souscription.',
      'La résiliation est possible à tout moment depuis les réglages du compte. Elle prend effet à la fin de la période en cours ; aucun remboursement au prorata n’est pratiqué, sauf disposition légale contraire.',
      'Conformément au droit de la consommation, tu disposes d’un délai de rétractation de quatorze jours à compter de la souscription, sauf renoncement exprès en cas d’exécution immédiate du service.',
    ],
  },
  {
    id: 'disponibilite',
    title: 'Disponibilité',
    body: [
      'Nous mettons en œuvre les moyens raisonnables pour assurer la continuité du service, sans garantie de disponibilité ininterrompue. Les interventions de maintenance planifiées sont annoncées au moins quarante-huit heures à l’avance.',
      'Les plans payants bénéficient d’un engagement de disponibilité mensuel de 99,5 %, hors maintenance planifiée et cas de force majeure.',
    ],
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    body: [
      'Notre responsabilité ne saurait excéder le montant des sommes versées au cours des douze mois précédant le fait générateur.',
      'Le service ne constitue pas une solution de sauvegarde unique. Il t’appartient de conserver une copie indépendante de tes fichiers importants.',
      'Aucune clause n’a pour effet d’exclure notre responsabilité en cas de faute lourde, de dol ou d’atteinte à l’intégrité des personnes.',
    ],
  },
  {
    id: 'resiliation',
    title: 'Suspension et résiliation',
    body: [
      'Nous pouvons suspendre un compte en cas de manquement caractérisé aux présentes conditions, après mise en demeure restée sans effet pendant sept jours, sauf urgence tenant à la protection de tiers.',
      'La suppression d’un compte entraîne l’effacement des fichiers sous trente jours, y compris dans les sauvegardes. Un export complet reste possible pendant ce délai.',
    ],
  },
  {
    id: 'droit',
    title: 'Droit applicable',
    body: [
      'Les présentes conditions sont soumises au droit français. En cas de différend, une solution amiable sera recherchée en priorité.',
      'Le consommateur peut recourir gratuitement à un médiateur de la consommation. À défaut d’accord, les tribunaux compétents sont ceux du ressort du domicile du défendeur.',
    ],
  },
];

export default function Page() {
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">Légal</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-[-0.04em]">
          Conditions générales
        </h1>
        <p className="mt-3 font-mono text-[11px] text-[#8F8F8F]">
          Dernière mise à jour : {UPDATED}
        </p>
        <nav className="mt-8 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA]/60 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A1A1A1]">
            Sommaire
          </p>
          <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id} className="flex gap-2 text-[13px]">
                <span className="font-mono tabular-nums text-[#A1A1A1]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <a href={`#${s.id}`} className="text-[#666] transition hover:text-[#171717]">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-12 space-y-12">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="flex items-baseline gap-3 text-[18px] font-semibold tracking-tight">
                <span className="font-mono text-[12px] tabular-nums text-[#A1A1A1]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 border-l border-[#EAEAEA] pl-5">
                {s.body.map((p) => (
                  <p key={p} className="text-[14px] leading-relaxed text-[#666]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-14 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA]/60 p-5">
          <p className="text-[13px] leading-relaxed text-[#666]">
            Une question sur ces conditions ? Écris-nous à{' '}
            <a href="mailto:legal@dropicture.com" className="text-[#171717] underline decoration-[#EAEAEA] underline-offset-4 hover:decoration-[#171717]">
              legal@dropicture.com
            </a>
            .
          </p>
        </div>
      </article>
    </>
  );
}