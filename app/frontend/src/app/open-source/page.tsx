// dropicture/app/frontend/src/app/open-source/page.tsx
import type { Metadata } from 'next'
import {
    TbBrandGithub,
    TbGitPullRequest,
    TbScale,
    TbTerminal2,
} from 'react-icons/tb'
import LayoutPublic, { SPARKLE } from '@/components/LayoutPublic'
import Link from 'next/link';

const TITLE = 'Open source'
const DESCRIPTION =
    'Dropicture is MIT-licensed and built in the open. Audit the code, self-host the full stack with Docker, or contribute on GitHub.'

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: 'https://dropicture.com/open-source' },
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://dropicture.com/open-source',
        siteName: 'Dropicture',
        title: `${TITLE} — Dropicture`,
        description: DESCRIPTION,
    },
    twitter: { card: 'summary', title: `${TITLE} — Dropicture`, description: DESCRIPTION },
}

const STACK = [
    'Next.js',
    'NestJS',
    'PostgreSQL',
    'Dragonfly',
    'Garage (S3)',
    'Docker',
    'Terraform',
    'Ansible',
]

const STEPS = [
    {
        title: 'Clone the repository',
        code: 'git clone https://github.com/redjem-amir/dropicture.git',
    },
    {
        title: 'Configure your environment',
        code: 'cd dropicture  # create your .env — see HELP.md',
    },
    {
        title: 'Start the stack',
        code: 'docker compose -f docker-compose.local.yml up -d',
    },
]

export default function OpenSourcePage() {
    return (
        <LayoutPublic
            active="/open-source"
            flip
            decor={
                <>
                    <svg viewBox="0 0 24 24" className="absolute left-[16%] top-[12%] hidden size-4 text-amber-400 md:block">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <svg viewBox="0 0 24 24" className="absolute bottom-[18%] right-[12%] hidden size-3.5 animate-pulse text-violet-400 md:block">
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
                    MIT licensed
                </span>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
                    Built in{' '}
                    <span className="relative inline-block">
                        the open.
                        <svg aria-hidden viewBox="0 0 120 12" className="absolute -bottom-3 left-1/2 h-3 w-full -translate-x-1/2 text-amber-400">
                            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                        </svg>
                    </span>
                </h1>
                <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-stone-500">
                    The code that runs dropicture.com is public — from the Terraform that provisions the
                    server to the button you&apos;re about to click. Nothing up our sleeves.
                </p>
                <Link
                    href="https://github.com/redjem-amir/dropicture"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                    <TbBrandGithub className="size-4.5" />
                    View on GitHub
                </Link>
            </section>
            <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6">
                <div className="relative">
                    <svg aria-hidden viewBox="0 0 24 24" className="absolute -right-4 -top-5 size-6 text-amber-400">
                        <path d={SPARKLE} fill="currentColor" />
                    </svg>
                    <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 shadow-[0_8px_40px_-12px_rgba(28,25,23,0.12)] backdrop-blur-sm sm:p-10">
                        <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
                            <TbTerminal2 className="size-6 text-stone-400" />
                            Self-host in three steps
                        </h2>
                        <svg aria-hidden viewBox="0 0 120 12" className="mt-1.5 h-3 w-28 text-amber-400">
                            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                        </svg>
                        <p className="mt-4 text-sm leading-relaxed text-stone-500">
                            The same containers that power the hosted service, on your machine. A laptop, a
                            homelab, a VPS — anywhere Docker runs. Frontend, API, PostgreSQL, Dragonfly and
                            S3-compatible storage start together, pre-wired.
                        </p>
                        <ol className="mt-7 space-y-5">
                            {STEPS.map((step, i) => (
                                <li key={step.title} className="flex gap-4">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-400 to-orange-500 text-xs font-semibold text-white shadow-[0_4px_12px_-2px_rgba(249,115,22,0.5)]">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-stone-900">{step.title}</p>
                                        <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-900 px-4 py-3 text-xs leading-relaxed text-stone-100">
                                            <code>{step.code}</code>
                                        </pre>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <p className="mt-6 text-xs text-stone-400">
                            Full instructions — environment variables, production deployment on your own cloud
                            with Terraform and Ansible — live in the repository&apos;s HELP.md and README.
                        </p>
                    </div>
                </div>
            </section>
            <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 pb-24 sm:px-6 md:grid-cols-2">
                <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 backdrop-blur-sm">
                    <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-stone-900">
                        <TbScale className="size-5 text-stone-400" />
                        An honest stack
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-stone-500">
                        Boring, proven, replaceable technology — chosen so anyone can run and maintain their
                        own instance without a platform team.
                    </p>
                    <ul className="mt-5 flex flex-wrap gap-2">
                        {STACK.map(item => (
                            <li
                                key={item}
                                className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600"
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-8 backdrop-blur-sm">
                    <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-stone-900">
                        <TbGitPullRequest className="size-5 text-stone-400" />
                        Contributions welcome
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-stone-500">
                        Dropicture is young and evolving in the open. Bug reports, ideas and pull requests all
                        help — the roadmap and issues live on GitHub, and the MIT license means your fork is
                        always an option.
                    </p>
                    <Link
                        href="https://github.com/redjem-amir/dropicture/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
                    >
                        Browse open issues
                    </Link>
                </div>
            </section>
        </LayoutPublic>
    )
}