// dropicture/app/frontend/src/app/auth/system/layout.tsx
import type { Metadata } from "next";

const TITLE = "Instance · Dropicture";
const DESCRIPTION = "Health and usage of this Dropicture instance.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/auth/system" },
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/auth/system",
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

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}