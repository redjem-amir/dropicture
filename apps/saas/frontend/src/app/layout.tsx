// dropicture/apps/saas/frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import "../globals.css";
import { UserProvider } from "@/components/UserProvider";
import { getSession } from "@/lib/session";

const font = Roboto_Flex({
  subsets: ["latin"],
  display: "swap",
});

const SITE = "https://app.dropicture.com";
const HEADLINE = "Dropicture · Collectionne, compose, partage";
const PITCH =
  "Épingle images et boucles vidéo dans des tableaux, retravaille-les, publie-les à celles et ceux qui te suivent. Une plateforme visuelle entre la collection et le réseau.";
const PITCH_SHORT =
  "Épingle, compose, publie. Tes images et tes boucles vidéo dans des tableaux qui te ressemblent.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  applicationName: "Dropicture",
  title: {
    default: HEADLINE,
    template: "%s · Dropicture",
  },
  description: PITCH,
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE,
    siteName: "Dropicture",
    title: HEADLINE,
    description: PITCH_SHORT,
  },
  twitter: {
    card: "summary",
    title: HEADLINE,
    description: PITCH_SHORT,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="fr" className={`${font.className}`}>
      <body>
        <UserProvider
          initialSessionUser={session?.user ?? null}
          initialAccessTokenExpiresAt={session?.accessExpiresAt}
        >
          {children}
        </UserProvider>
      </body>
    </html>
  );
}