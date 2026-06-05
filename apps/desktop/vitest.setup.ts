// Vitest setup (jsdom).
//
// Under Node 25, vitest's jsdom `window.localStorage` is missing the Storage
// methods (`clear`/`getItem`/`setItem`/`removeItem`), so the ~57 store tests
// that touch localStorage fail with "window.localStorage.clear is not a
// function". Install a minimal in-memory Storage when the env's is absent or
// broken, on both the jsdom window and globalThis.

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function installStorage(target: typeof globalThis | (Window & typeof globalThis), prop: 'localStorage' | 'sessionStorage') {
  const current = (target as Record<string, unknown>)[prop] as Storage | undefined

  if (current && typeof current.clear === 'function') {
    return
  }

  Object.defineProperty(target, prop, {
    configurable: true,
    writable: true,
    value: new MemoryStorage()
  })
}

for (const prop of ['localStorage', 'sessionStorage'] as const) {
  installStorage(globalThis, prop)

  if (typeof window !== 'undefined' && (window as unknown) !== (globalThis as unknown)) {
    installStorage(window, prop)
  }
}
