// dropicture/apps/frontend/src/app/signin/layout.tsx
import { UserProvider } from "@/components/UserProvider";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";

const TITLE = "Sign in · Dropicture";
const DESCRIPTION =
  "Sign in to your Dropicture account and access your photo library — free, open source, and yours.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dropicture.com/signin" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dropicture.com/signin",
    siteName: "Dropicture",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function SigninLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <UserProvider
      initialSessionUser={session?.user ?? null}
      initialAccessTokenExpiresAt={session?.accessExpiresAt}
    >
      <>{children}</>
    </UserProvider>
  );
}