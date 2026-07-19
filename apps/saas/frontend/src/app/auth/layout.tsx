// dropicture/apps/saas/frontend/src/app/auth/layout.tsx
import Navbar from '@/components/Navbar';
import type { Metadata } from 'next';

const TITLE = 'Ton fil';
const DESCRIPTION =
    "Tes tableaux, tes épingles et les publications de celles et ceux que tu suis. Images et boucles vidéo, au même endroit.";
const OG_TITLE = `${TITLE} · Dropicture`;

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/auth' },
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
        type: 'website',
        locale: 'fr_FR',
        url: '/auth',
        siteName: 'Dropicture',
        title: OG_TITLE,
        description: DESCRIPTION,
    },
    twitter: {
        card: 'summary',
        title: OG_TITLE,
        description: DESCRIPTION,
    },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-white font-sans text-[#171717] antialiased selection:bg-[#171717]/10 selection:text-[#171717]">
            <Navbar />
            <main className="min-h-0 flex-1">{children}</main>
        </div>
    );
}