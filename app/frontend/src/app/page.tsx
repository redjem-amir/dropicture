// dropicture/app/frontend/src/app/page.tsx
import Link from 'next/link'
import { TbArrowRight, TbBolt, TbBrandGithub, TbCheck, TbCloud, TbDownload, TbHome, TbServer2, TbShieldLock, TbTerminal2, TbWorld } from 'react-icons/tb'
import LayoutPublic from '@/components/LayoutPublic'

const GITHUB_URL = 'https://github.com/redjem-amir/dropicture'

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

const CONTAINERS = ['db', 'storage', 'api', 'frontend']

const BTN_PRIMARY =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700'
const BTN_SECONDARY =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-6 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900'

export default function HomePage() {
  return (
    <LayoutPublic
      decor={
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-160 bg-[linear-gradient(to_right,rgba(28,25,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.05)_1px,transparent_1px)] bg-size-[56px_56px] mask-[radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -top-55 h-110 w-170 -translate-x-1/2 rounded-full bg-amber-100/50 blur-3xl"
          />
        </>
      }
    >
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/open-source"
            className="group inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-3 pr-2 text-xs font-medium text-stone-600 shadow-sm transition-colors hover:border-stone-300"
          >
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
            </span>
            Open source · Hosted in Europe
            <TbArrowRight className="size-3.5 text-stone-400 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-8 text-balance bg-linear-to-b from-stone-900 to-stone-600 bg-clip-text text-5xl font-semibold leading-[1.05] tracking-tighter text-transparent sm:text-7xl">
            Your photos, on your terms.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-stone-500 sm:text-lg">
            Dropicture is a free, open source home for your photos — no ads, no tracking, no
            lock-in. Use our European cloud, or host it yourself anywhere.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
              Create your account
              <TbArrowRight className="size-4" />
            </Link>
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_SECONDARY} w-full sm:w-auto`}
            >
              <TbBrandGithub className="size-4" />
              Star on GitHub
            </Link>
          </div>
        </div>
      </section>
      <section className="border-y border-stone-200/70 bg-white/60">
        <ul className="mx-auto grid w-full max-w-6xl grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-stone-200/70">
          {TRUST.map(item => (
            <li
              key={item}
              className="flex items-center justify-center gap-2 px-4 py-5 text-xs font-medium uppercase tracking-wider text-stone-500"
            >
              <TbCheck className="size-3.5 shrink-0 text-stone-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
            Why Dropicture
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tighter text-stone-900 sm:text-4xl">
            Everything a photo home should be
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-500">
            Built on one conviction: storing your memories shouldn&apos;t cost you your privacy.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="group bg-white p-8 transition-colors hover:bg-stone-50">
              <span className="inline-flex size-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors group-hover:border-stone-300 group-hover:text-stone-900">
                <f.icon className="size-5" strokeWidth={1.5} />
              </span>
              <h3 className="mt-5 text-sm font-semibold text-stone-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t border-stone-200/70 bg-stone-50/60">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-stone-400">
              Deployment
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tighter text-stone-900 sm:text-4xl">
              Three ways to run it
            </h2>
            <div className="mt-10 space-y-8">
              {DEPLOY_MODES.map(m => (
                <div
                  key={m.title}
                  className="flex items-start gap-5 border-t border-stone-200/70 pt-8 first:border-t-0 first:pt-0"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 shadow-sm">
                    <m.icon className="size-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">{m.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-10">
              <Link
                href="/open-source"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-stone-900 underline-offset-4 hover:underline"
              >
                Learn about self-hosting
                <TbArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </p>
          </div>
          <div>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-900/4">
              <div className="flex items-center gap-1.5 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
                <span className="size-2.5 rounded-full bg-stone-300/70" aria-hidden />
                <span className="size-2.5 rounded-full bg-stone-300/70" aria-hidden />
                <span className="size-2.5 rounded-full bg-stone-300/70" aria-hidden />
                <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-stone-400">
                  <TbTerminal2 className="size-3.5" />
                  ~/dropicture
                </span>
              </div>
              <div className="overflow-x-auto whitespace-pre p-5 font-mono text-[13px] leading-7 text-stone-500">
                <p>
                  <span className="select-none text-stone-300">$ </span>
                  <span className="text-stone-800">git clone {GITHUB_URL}</span>
                </p>
                <p>
                  <span className="select-none text-stone-300">$ </span>
                  <span className="text-stone-800">cd dropicture</span>
                </p>
                <p>
                  <span className="select-none text-stone-300">$ </span>
                  <span className="text-stone-800">docker compose -f docker-compose.local.yml up -d</span>
                </p>
                {CONTAINERS.map(name => (
                  <p key={name}>
                    <span className="text-emerald-600">{' ✔'}</span>
                    {` Container ${`dropicture-${name}`.padEnd(22)}`}
                    <span className="text-emerald-600">Started</span>
                  </p>
                ))}
                <p className="mt-3 font-medium text-stone-900">
                  <span className="text-amber-600">→ </span>
                  Dropicture ready on http://localhost:3000
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-stone-400">
              The full stack — frontend, API, database, object storage — in one command.
            </p>
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
            Bring your photos home
          </h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-stone-500">
            Free account, no credit card, no newsletter. Just a quiet, private place for your
            pictures.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
              Get started — it&apos;s free
              <TbArrowRight className="size-4" />
            </Link>
            <Link href="/open-source" className={`${BTN_SECONDARY} w-full sm:w-auto`}>
              <TbTerminal2 className="size-4" />
              Self-host with Docker
            </Link>
          </div>
        </div>
      </section>
    </LayoutPublic>
  )
}