// dropicture/app/frontend/src/lib/routeAccess.ts
import { IconType } from 'react-icons'
import { TbEye, TbPictureInPicture, TbUser } from 'react-icons/tb'

export type Scope = string

export type NavTarget = string

type BaseItem = {
    scopes?: Scope[]
    navTarget?: NavTarget
}

export type RouteItem =
    | (BaseItem & {
        type: 'route'
        path: string
        nav?: {
            label: string
            icon?: IconType
        }
    })
    | (BaseItem & {
        type: 'section'
        nav?: {
            label: string
        }
    })

export function isRoute(
    item: RouteItem,
): item is Extract<RouteItem, { type: 'route' }> {
    return item.type === 'route'
}

export const ROUTE_ACCESS: RouteItem[] = [
    { type: 'section', nav: { label: `` } },
    { type: 'route', path: '/', nav: { label: 'Accueil', icon: TbPictureInPicture } },
    { type: 'section', nav: { label: `Administration` } },
    { type: 'route', path: '/accounts', scopes: ['accounts.read', 'accounts.write'], nav: { label: 'Comptes', icon: TbUser } },
    { type: 'route', path: '/roles', scopes: ['roles.read', 'roles.write'], nav: { label: 'Rôles', icon: TbEye } },
]