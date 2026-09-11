/** Resolve a file from `public/` against the Vite base path (e.g. `/Helloworld/` on GitHub Pages). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const relative = path.replace(/^\//, '')
  return `${base}${relative}`
}
