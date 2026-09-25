export declare function attachSocket(io: unknown): unknown
export declare function isInternalRequest(req: unknown): boolean
export declare function handleInternalRequest(req: unknown, res: unknown, io: unknown, body: unknown): boolean
export declare function internalBroadcast(event: string, payload: unknown, rooms?: string[]): Promise<void>
export declare function userPublic(u: unknown): Record<string, unknown> | null
