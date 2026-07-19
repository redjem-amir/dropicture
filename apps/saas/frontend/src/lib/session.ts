// dropicture/apps/saas/frontend/src/lib/session.ts
import { cookies } from 'next/headers'
import { cache } from 'react'

export interface SessionUser {
  sub: string
}

export interface Session {
  user: SessionUser
  accessExpiresAt: number
}

export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await cookies()).get('session')?.value
  if (!cookie) return null
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resolve`, {
      method: 'POST',
      headers: { Cookie: `session=${cookie}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data?.sub !== 'string') return null
    return {
      user: { sub: data.sub },
      accessExpiresAt: typeof data.accessExpiresAt === 'number' ? data.accessExpiresAt : 0,
    }
  } catch {
    return null
  }
})