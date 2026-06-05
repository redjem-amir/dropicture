// dropicture/app/frontend/src/lib/session.ts
import { cookies } from 'next/headers'
import { cache } from 'react'

export interface SessionUser {
  sub: string
  scope: string
  roles: string[]
}

export interface Session {
  user: SessionUser
  accessExpiresAt: number
}

function backendOrigin(): string {
  return process.env.NODE_ENV === 'production'
    ? (process.env.NEXT_PUBLIC_URL as string)
    : 'http://localhost:3000'
}

export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await cookies()).get('session')?.value
  if (!cookie) return null
  try {
    const res = await fetch(`${backendOrigin()}/api/auth/resolve`, {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const d = await res.json()
    return {
      user: {
        sub: d.sub,
        scope: typeof d.scope === 'string' ? d.scope : '',
        roles: Array.isArray(d.roles) ? d.roles : [],
      },
      accessExpiresAt: d.accessExpiresAt ?? 0,
    }
  } catch {
    return null
  }
})