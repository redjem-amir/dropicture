// dropicture/app/frontend/src/app/page.tsx
import Link from 'next/link'
import {
  TbArrowRight,
  TbBolt,
  TbBrandGithub,
  TbCloud,
  TbDownload,
  TbHome,
  TbServer2,
  TbShieldLock,
  TbWorld,
} from 'react-icons/tb'
import LayoutPublic, { SPARKLE } from '@/components/LayoutPublic'

const FEATURES = [
  {
    icon: TbShieldLock,
    title: 'Private by design',
    text: 'No ads, no trackers, no profiling. One essential cookie keeps you signed in — that\u2019s the whole list.',
  },
  {
    icon: TbBrandGithub,
    title: 'Open source, MIT',
    text: 'Every line is public and auditable. The hosted service runs the exact same code you can read on GitHub.',
  },
  {
    icon: TbWorld,
    title: 'Hosted in Europe',
    text: 'Your photos live in Falkenstein, Germany, under EU law — never replicated outside the European Union.',
  },
  {
    icon: TbDownload,
    title: 'No lock-in',
    text: 'Your content stays yours, full stop. Export everything or delete your account whenever you want.',
  },
  {
    icon: TbServer2,
    title: 'Self-hostable',
    text: 'Run the whole stack on your own machine or cloud with Docker — in minutes, not days.',
  },
  {
    icon: TbBolt,
    title: 'Light & fast',
    text: 'No bloat, no third-party scripts. Your photos are the star, not our JavaScript.',
  },
]

const DEPLOY_MODES = [
  {
    icon: TbCloud,
    title: 'Use dropicture.com',
    text: 'The official instance: free account, EU servers, nothing to install. Sign up and start uploading.',
  },
  {
    icon: TbHome,
    title: 'Run it at home',
    text: 'One docker compose command starts the full stack — frontend, API, database, object storage — on any machine.',
  },
  {
    icon: TbServer2,
    title: 'Deploy on your cloud',
    text: 'Terraform and Ansible for a production-grade single-server deployment are in the repo, documented end to end.',
  },
]

const TRUST = ['Free to use', 'MIT licensed', 'EU data residency', '0 trackers, 1 cookie']

export default function HomePage() {
  return (
    <LayoutPublic
      decor={
        <>
          <svg
            viewBox="0 0 150 180"
            className="absolute left-[3%] top-[18%] hidden w-36 -rotate-6 drop-shadow-[0_16px_32px_rgba(0,0,0,0.10)] lg:block xl:w-44"
          >
            <defs>
              <linearGradient id="hm-pl1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFEDD5" />
                <stop offset="100%" stopColor="#FED7AA" />
              </linearGradient>
            </defs>
            <rect x="0.5" y="0.5" width="149" height="179" rx="14" fill="#fff" stroke="#E7E5E4" />
            <rect x="12" y="12" width="126" height="126" rx="10" fill="url(#hm-pl1)" />
            <circle cx="103" cy="48" r="14" fill="#FBBF24" />
            <path d="M12 138 L50 84 L76 114 L100 88 L138 138 Z" fill="#FDBA74" />
            <path d="M12 138 L42 100 L70 138 Z" fill="#FB923C" />
            <rect x="12" y="150" width="72" height="8" rx="4" fill="#E7E5E4" />
          </svg>
          <svg
            viewBox="0 0 150 180"
            className="absolute right-[3%] top-[26%] hidden w-36 rotate-[8deg] drop-shadow-[0_16px_32px_rgba(0,0,0,0.10)] lg:block xl:w-44"
          >
            <rect x="0.5" y="0.5" width="149" height="179" rx="14" fill="#fff" stroke="#E7E5E4" />
            <rect x="12" y="12" width="126" height="126" rx="10" fill="#FFF7ED" />
            <rect x="56" y="44" width="38" height="16" rx="6" fill="#F97316" />
            <rect x="30" y="54" width="90" height="58" rx="12" fill="#FB923C" />
            <circle cx="75" cy="83" r="19" fill="#FFEDD5" />
            <circle cx="75" cy="83" r="11" fill="#9A3412" />
            <circle cx="71" cy="79" r="3" fill="#fff" opacity="0.8" />
            <circle cx="106" cy="64" r="4" fill="#FDE68A" />
            <rect x="12" y="150" width="64" height="8" rx="4" fill="#E7E5E4" />
          </svg>

          <svg viewBox="0 0 24 24" className="absolute left-[24%] top-[12%] hidden size-5 text-amber-400 md:block">
            <path d={SPARKLE} fill="currentColor" />
          </svg>
          <svg viewBox="0 0 24 24" className="absolute right-[22%] top-[16%] hidden size-4 animate-pulse text-violet-400 md:block">
            <path d={SPARKLE} fill="currentColor" />
          </svg>
        </>
      }
    >
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
            <svg viewBox="0 0 24 24" className="size-3 text-amber-500" aria-hidden="true">
              <path d={SPARKLE} fill="currentColor" />
            </svg>
            Open source · Hosted in Europe
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-stone-900 sm:text-6xl">
            Your photos,
            <br />
            on{' '}
            <span className="relative inline-block">
              your terms.
              <svg aria-hidden viewBox="0 0 120 12" className="absolute -bottom-3 left-1/2 h-3 w-full -translate-x-1/2 text-amber-400">
                <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-stone-500 sm:text-lg">
            Dropicture is a free, open source home for your photos — no ads, no tracking, no
            lock-in. Use our European cloud, or host it yourself anywhere.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-medium text-white transition hover:bg-stone-700 sm:w-auto"
            >
              Create your account
              <TbArrowRight className="size-4" />
            </Link>
            <Link
              href="https://github.com/redjem-amir/dropicture"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-6 text-sm font-medium text-stone-700 transition hover:bg-stone-50 sm:w-auto"
            >
              <TbBrandGithub className="size-4.5" />
              Star on GitHub
            </Link>
          </div>
        </div>
        <ul className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {TRUST.map(item => (
            <li key={item} className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
              <svg viewBox="0 0 24 24" className="size-2.5 text-amber-400" aria-hidden="true">
                <path d={SPARKLE} fill="currentColor" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Everything a photo home should be
          </h2>
          <svg aria-hidden viewBox="0 0 120 12" className="mx-auto mt-2 h-3 w-28 text-amber-400">
            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            Built on one conviction: storing your memories shouldn&apos;t cost you your privacy.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="rounded-3xl border border-stone-200/80 bg-white/80 p-6 shadow-[0_8px_40px_-12px_rgba(28,25,23,0.08)] backdrop-blur-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-[0_6px_16px_-4px_rgba(249,115,22,0.4)]">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            Three ways to run it
          </h2>
          <svg aria-hidden viewBox="0 0 120 12" className="mx-auto mt-2 h-3 w-28 text-amber-400">
            <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {DEPLOY_MODES.map((m, i) => (
            <div
              key={m.title}
              className="relative rounded-3xl border border-stone-200/80 bg-white/80 p-6 backdrop-blur-sm"
            >
              <span className="absolute right-5 top-5 text-4xl font-semibold text-stone-100">
                {i + 1}
              </span>
              <span className="flex size-10 items-center justify-center rounded-xl bg-stone-900 text-amber-400">
                <m.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-stone-900">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{m.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/open-source"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
          >
            Learn about self-hosting
            <TbArrowRight className="size-4" />
          </Link>
        </p>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-3xl">
          <svg aria-hidden viewBox="0 0 24 24" className="absolute -right-4 -top-5 size-7 text-amber-400">
            <path d={SPARKLE} fill="currentColor" />
          </svg>
          <svg aria-hidden viewBox="0 0 24 24" className="absolute -bottom-4 -left-6 size-5 animate-pulse text-violet-400">
            <path d={SPARKLE} fill="currentColor" />
          </svg>
          <div className="rounded-3xl border border-stone-200/80 bg-white/80 p-10 text-center shadow-[0_8px_40px_-12px_rgba(28,25,23,0.12)] backdrop-blur-sm sm:p-14">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Bring your photos home
            </h2>
            <svg aria-hidden viewBox="0 0 120 12" className="mx-auto mt-2 h-3 w-28 text-amber-400">
              <path d="M3 8 C 22 3, 42 10, 62 6 S 100 4, 117 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone-500">
              Free account, no credit card, no newsletter. Just a quiet, private place for your
              pictures.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-8 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              Get started — it&apos;s free
              <TbArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </LayoutPublic>
  )
}