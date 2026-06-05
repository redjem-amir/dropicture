// dropicture/app/frontend/src/lib/scopes.ts
export function hasScope(
    userScope: string | undefined,
    required?: string[],
): boolean {
    if (!required || required.length === 0) return true
    if (!userScope) return false
    const owned = new Set(userScope.split(' ').filter(Boolean))
    return required.some((s) => owned.has(s))
}

export function hasRole(
    userRoles: string[] | undefined,
    required: string,
): boolean {
    return Array.isArray(userRoles) && userRoles.includes(required)
}