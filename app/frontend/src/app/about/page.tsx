// dropicture/app/frontend/src/app/about/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { TbArrowRight, TbCode, TbHeart, TbMapPin } from 'react-icons/tb'
import LayoutPublic, { SPARKLE } from '@/components/LayoutPublic'

const TITLE = 'About'
const DESCRIPTION =
    'Why Dropicture exists: an independent, open source alternative for storing photos without giving up privacy or ownership.'

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: 'https://dropicture.com/about' },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://dropicture.com/about',
        siteName: 'Dropicture',
        title: `${TITLE} — Dropicture`,
        description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: `${TITLE} — Dropicture`, description: DESCRIPTION },
}

const VALUES = [
    {
        icon: TbHeart,
        title: 'Sovereignty',
        text: 'Your memories shouldn\u2019t depend on the goodwill of an ad-tech giant. European hosting, your ownership, and an exit door that is always open.',
    },
    {
        icon: TbCode,
        title: 'Transparency',
        text: 'Open source isn\u2019t a marketing badge here — it\u2019s the whole trust model. If we say it on this site, you can read it in the code.',
    },
    {
        icon: TbMapPin,
        title: 'Simplicity',
        text: 'A photo service should store photos, beautifully and quietly. No engagement metrics, no dark patterns, no upsells.',
    },
]

export default function AboutPage() {
    return (
        <LayoutPublic
            active="/about"
            decor={
                <>
                    <svg
                        viewBox="0 0 150 180"
                        className="absolute right-[4%] top-[18%] hidden w-36 rotate-[7deg] drop-shadow-[0_16px_32px_rgba(0,0,0,0.10)] lg:block"
                    >
                        <defs>
                            <linearGradient id="ab-pl1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#EDE9FE" />
                                <stop offset="100%" stopColor="#DDD6FE" />
                            </linearGradient>
                        </defs>
                        <rect x="0.5" y="0.5" width="149" height="179" rx="14" fill="#fff" stroke="#E7E5E4" />
                        <rect x="12" y="12" width="126" height="126" rx="10" fill="url(#ab-pl1)" />
                        <circle cx="52" cy="50" r="12" fill="#A78BFA" />
                        <path d="M12 100 Q 40 92 75 100 T 138 100 V 138 H 12 Z" fill="#C4B5FD" />
                        <path d="M30 116 q 6 -4 12 0 M58 122 q 6 -4 12 0 M92 116 q 6 -4 12 0" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
                        <rect x="12" y="150" width="58" height="8" rx="4" fill="#E7E5E4" />
                    </svg>
                    <svg viewBox="0 0 24 24" className="absolute left-[18%] top-[14%] hidden size-4 text-amber-400 md:block">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <svg viewBox="0 0 24 24" className="absolute bottom-[20%] left-[10%] hidden size-3.5 animate-pulse text-violet-400 md:block">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                </>
            }
        >
            <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-16 text-center sm:px-6 sm:pt-20">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
                    <svg viewBox="0 0 24 24" className="size-3 text-amber-500" aria-hidden="true">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    About the project
                </span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                    A quieter home
                    <br />
                    for your{' '}
                    <span className="relative inline-block">
                        memories.
                        <svg aria-hidden viewBox="0 0 120 12" className="absolute -bottom-3 left-1/2 h-3 w-full -translate-x-1/2 text-amber-400">
                            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                        </svg>
                    </span>
                </h1>
            </section>
            <section className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
                <div className="space-y-4 text-sm leading-relaxed text-stone-600 sm:text-base">
                    <p>
                        Dropicture started with a simple discomfort: the photos that matter most to us live on
                        platforms whose business is to know us better. Every album feeds a profile; every face,
                        a model. Convenient — and quietly expensive.
                    </p>
                    <p>
                        So we&apos;re building the alternative we wanted: a photo service that is free,{' '}
                        <strong className="font-semibold text-stone-900">open source under the MIT license</strong>
                        , hosted in the European Union, and architected so that leaving is as easy as joining.
                        It&apos;s an independent project, built in the open by{' '}
                        <strong className="font-semibold text-stone-900">Amir Redjem</strong> and whoever cares
                        to contribute.
                    </p>
                    <p>
                        Dropicture is young — features will grow, the design will evolve, and everything will
                        happen in public. What won&apos;t change are the principles below.
                    </p>
                </div>
            </section>
            <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 pb-16 sm:grid-cols-3 sm:px-6">
                {VALUES.map(v => (
                    <div key={v.title} className="rounded-3xl border border-stone-200/80 bg-white/80 p-6 backdrop-blur-sm">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-[0_6px_16px_-4px_rgba(249,115,22,0.4)]">
                            <v.icon className="size-5" />
                        </span>
                        <h2 className="mt-4 text-base font-semibold text-stone-900">{v.title}</h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{v.text}</p>
                    </div>
                ))}
            </section>
            <section className="mx-auto w-full max-w-2xl px-4 pb-24 text-center sm:px-6">
                <p className="text-sm text-stone-500">
                    Questions, ideas, or just want to say hello?{' '}
                    <Link
                        href="mailto:contact@dropicture.com"
                        className="font-medium text-stone-900 underline-offset-4 hover:underline"
                    >
                        contact@dropicture.com
                    </Link>
                </p>
                <Link
                    href="/signup"
                    className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-8 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                    Join Dropicture
                    <TbArrowRight className="size-4" />
                </Link>
            </section>
        </LayoutPublic>
    )
}