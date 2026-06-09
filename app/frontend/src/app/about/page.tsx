// dropicture/app/frontend/src/app/about/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { TbArrowRight, TbCode, TbKey, TbPhoto } from 'react-icons/tb'
import LayoutPublic from '@/components/LayoutPublic'

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
        icon: TbKey,
        title: 'Sovereignty',
        text: 'Your memories shouldn\u2019t depend on the goodwill of an ad-tech giant. European hosting, your ownership, and an exit door that is always open.',
    },
    {
        icon: TbCode,
        title: 'Transparency',
        text: 'Open source isn\u2019t a marketing badge here — it\u2019s the whole trust model. If we say it on this site, you can read it in the code.',
    },
    {
        icon: TbPhoto,
        title: 'Simplicity',
        text: 'A photo service should store photos, beautifully and quietly. No engagement metrics, no dark patterns, no upsells.',
    },
]

const BTN_PRIMARY =
    'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700'

export default function AboutPage() {
    return (
        <LayoutPublic
            active="/about"
            decor={
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-120 bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)]"
                />
            }
        >
            <section className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-20 text-center sm:px-6 sm:pt-28">
                <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
                    <span className="relative flex size-1.5" aria-hidden>
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                    </span>
                    About the project
                </span>
                <h1 className="mx-auto mt-8 max-w-2xl text-balance bg-linear-to-b from-stone-900 to-stone-600 bg-clip-text text-4xl font-semibold leading-[1.05] tracking-tighter text-transparent sm:text-6xl">
                    A quieter home for your memories.
                </h1>
            </section>
            <section className="mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6">
                <div className="space-y-5 text-pretty text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
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
            <section className="border-t border-stone-200/70 bg-stone-50/60">
                <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
                    <div className="max-w-2xl">
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
                            Principles
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tighter text-stone-900 sm:text-4xl">
                            What won&apos;t change
                        </h2>
                    </div>
                    <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-200/70 sm:grid-cols-3">
                        {VALUES.map(v => (
                            <div key={v.title} className="group bg-white p-8 transition-colors hover:bg-stone-50">
                                <span className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors group-hover:border-stone-300 group-hover:text-stone-900">
                                    <v.icon className="size-5" strokeWidth={1.5} />
                                </span>
                                <h3 className="mt-5 text-sm font-semibold text-stone-900">{v.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-stone-500">{v.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="relative overflow-hidden border-t border-stone-200/70">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-105 bg-[linear-gradient(to_right,rgba(28,25,23,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.04)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_70%_70%_at_50%_100%,#000_45%,transparent_100%)]"
                />
                <div className="relative mx-auto w-full max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
                    <h2 className="text-balance text-3xl font-semibold tracking-tighter text-stone-900 sm:text-5xl">
                        Join Dropicture
                    </h2>
                    <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-stone-500">
                        Questions, ideas, or just want to say hello? Write to{' '}
                        <Link
                            href="mailto:contact@dropicture.com"
                            className="font-medium text-stone-900 underline-offset-4 hover:underline"
                        >
                            contact@dropicture.com
                        </Link>
                        {' '}— or jump straight in.
                    </p>
                    <Link href="/signup" className={`${BTN_PRIMARY} mt-10 px-8`}>
                        Create your account
                        <TbArrowRight className="size-4" />
                    </Link>
                </div>
            </section>
        </LayoutPublic>
    )
}