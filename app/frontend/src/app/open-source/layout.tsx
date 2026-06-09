// dropicture/app/frontend/src/app/open-source/layout.tsx
import type { Metadata } from "next";

const TITLE = "Open source";
const OG_TITLE = "Open source · Dropicture";
const DESCRIPTION =
    "Dropicture is MIT-licensed and built in the open. Audit the code, self-host the full stack with Docker, or contribute on GitHub.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "https://dropicture.com/open-source" },
    robots: { index: true, follow: true },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dropicture.com/open-source",
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