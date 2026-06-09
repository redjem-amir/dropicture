// dropicture/app/frontend/src/app/open-source/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { TbArrowUpRight, TbBrandGithub, TbGitPullRequest, TbScale, TbTerminal2 } from 'react-icons/tb'
import LayoutPublic from '@/components/LayoutPublic'

const TITLE = 'Open source'
const DESCRIPTION = 'Dropicture is MIT-licensed and built in the open. Audit the code, self-host the full stack with Docker, or contribute on GitHub.'

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

const GITHUB_URL = 'https://github.com/redjem-amir/dropicture'

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
        code: 'cd dropicture',
        comment: '# create your .env — see HELP.md',
    },
    {
        title: 'Start the stack',
        code: 'docker compose -f docker-compose.local.yml up -d',
    },
]

const BTN_PRIMARY =
    'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700'
const BTN_SECONDARY =
    'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-6 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'

export default function OpenSourcePage() {
    return (
        <LayoutPublic
            active="/open-source"
            flip
            decor={
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-120 bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)]"
                />
            }
        >
            <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
                <div className="mx-auto max-w-2xl text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 shadow-sm">
                        <span className="relative flex size-1.5" aria-hidden>
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                        </span>
                        MIT licensed
                    </span>
                    <h1 className="mt-8 text-balance bg-linear-to-b from-stone-900 to-stone-600 bg-clip-text text-4xl font-semibold leading-[1.05] tracking-tighter text-transparent sm:text-6xl">
                        Built in the open.
                    </h1>
                    <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-stone-500">
                        The code that runs dropicture.com is public — from the Terraform that provisions the
                        server to the button you&apos;re about to click. Nothing up our sleeves.
                    </p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Link
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${BTN_PRIMARY} w-full sm:w-auto`}
                        >
                            <TbBrandGithub className="size-4" />
                            View on GitHub
                        </Link>
                        <Link href="#self-host" className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                            <TbTerminal2 className="size-4" />
                            Self-host guide
                        </Link>
                    </div>
                </div>
            </section>
            <section id="self-host" className="scroll-mt-16 border-t border-stone-200/70 bg-stone-50/60">
                <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16">
                    <div>
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
                            Self-hosting
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tighter text-stone-900 sm:text-4xl">
                            Self-host in three steps
                        </h2>
                        <p className="mt-4 text-base leading-relaxed text-stone-500">
                            The same containers that power the hosted service, on your machine. A laptop, a
                            homelab, a VPS — anywhere Docker runs. Frontend, API, PostgreSQL, Dragonfly and
                            S3-compatible storage start together, pre-wired.
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-stone-500">
                            Full instructions — environment variables, production deployment on your own cloud
                            with Terraform and Ansible — live in the repository&apos;s HELP.md and README.
                        </p>
                        <p className="mt-8">
                            <Link
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
                            >
                                Read the full guide on GitHub
                                <TbArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </Link>
                        </p>
                    </div>
                    <ol className="divide-y divide-stone-200/70 overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-xl shadow-stone-900/4">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="flex gap-5 p-6 sm:p-7">
                                <span className="select-none pt-0.5 font-mono text-xs leading-5 text-stone-300">
                                    0{i + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-stone-900">{step.title}</h3>
                                    <div className="mt-3 overflow-x-auto whitespace-nowrap rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 font-mono text-xs leading-relaxed">
                                        <span className="select-none text-stone-400">$ </span>
                                        <span className="text-stone-800">{step.code}</span>
                                        {step.comment && (
                                            <span className="ml-3 text-stone-400">{step.comment}</span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>
            <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
                <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-200/70 md:grid-cols-2">
                    <div className="bg-white p-8">
                        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm">
                            <TbScale className="size-5" strokeWidth={1.5} />
                        </span>
                        <h2 className="mt-5 text-sm font-semibold text-stone-900">An honest stack</h2>
                        <p className="mt-2 text-sm leading-relaxed text-stone-500">
                            Boring, proven, replaceable technology — chosen so anyone can run and maintain
                            their own instance without a platform team.
                        </p>
                        <ul className="mt-5 flex flex-wrap gap-2">
                            {STACK.map(item => (
                                <li
                                    key={item}
                                    className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 font-mono text-xs text-stone-600"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-white p-8">
                        <span className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm">
                            <TbGitPullRequest className="size-5" strokeWidth={1.5} />
                        </span>
                        <h2 className="mt-5 text-sm font-semibold text-stone-900">Contributions welcome</h2>
                        <p className="mt-2 text-sm leading-relaxed text-stone-500">
                            Dropicture is young and evolving in the open. Bug reports, ideas and pull requests
                            all help — the roadmap and issues live on GitHub, and the MIT license means your
                            fork is always an option.
                        </p>
                        <Link
                            href={`${GITHUB_URL}/issues`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
                        >
                            Browse open issues
                            <TbArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                    </div>
                </div>
            </section>
        </LayoutPublic>
    )
}