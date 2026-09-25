export declare function hashPassword(password: string): string
export declare function verifyPassword(password: string, stored: string): boolean
export declare function signToken(payload: Record<string, unknown>, expiresInSec?: number): string
export declare function verifyToken(token?: string | null): { sub: string; [k: string]: unknown } | null
export declare function parseCookies(header?: string | null): Record<string, string>
