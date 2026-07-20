// dropicture/apps/saas/frontend/src/app/signup/layout.tsx
import type { Metadata } from "next";

const TITLE = "Créer un compte";
const DESCRIPTION =
    "Trois étapes · profil, e-mail, mot de passe et ton premier tableau est prêt à recevoir tes images et tes boucles.";
const OG_TITLE = `${TITLE} · Dropicture`;

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/signup" },
    openGraph: {
        type: "website",
        locale: "fr_FR",
        url: "/signup",
        siteName: "Dropicture",
        title: OG_TITLE,
        description: DESCRIPTION,
    },
    twitter: {
        card: "summary",
        title: OG_TITLE,
        description: DESCRIPTION,
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}