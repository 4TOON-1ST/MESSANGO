/* Client-side API helpers */

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'خطایی رخ داد')
  }
  return data
}

export const api = {
  get: <T = unknown>(path: string) => request(path) as Promise<T>,
  post: <T = unknown>(path: string, body?: unknown) =>
    request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }) as Promise<T>,
  patch: <T = unknown>(path: string, body?: unknown) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body) }) as Promise<T>,
  del: <T = unknown>(path: string) => request(path, { method: 'DELETE' }) as Promise<T>,
  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request('/api/upload', { method: 'POST', body: form }) as Promise<{
      url: string
      name: string
      size: number
      mime: string
      kind: 'image' | 'audio' | 'video' | 'file'
    }>
  },
}
