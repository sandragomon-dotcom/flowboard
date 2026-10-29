import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { seo } from '../seo-plugin'

// Vitest runs from the project root.
const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('index.html (SEO)', () => {
  const html = read('index.html')

  it('has a title, description and language', () => {
    expect(html).toContain('<html lang="en">')
    expect(html).toMatch(/<title>Flowboard[^<]+<\/title>/)
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{50,}"/)
  })

  it('has Open Graph and Twitter tags', () => {
    for (const tag of ['og:title', 'og:description', 'og:type', 'og:image:alt']) expect(html).toContain(`property="${tag}"`)
    expect(html).toContain('name="twitter:card"')
  })

  it('ships crawlable fallback content with a heading before JavaScript runs', () => {
    expect(html).toMatch(/<div id="root">[\s\S]*<h1>Flowboard<\/h1>/)
  })

  it('has the placeholder the SEO plugin fills in', () => {
    expect(html).toContain('<!-- %SEO_URLS% -->')
  })
})

describe('SEO build plugin', () => {
  const html = '<head><!-- %SEO_URLS% --></head>'
  const transform = (url: string) => (seo(url).transformIndexHtml as (h: string) => string)(html)

  it('adds canonical, absolute image URLs and structured data when a site URL is set', () => {
    const out = transform('https://flowboard.example.com/')
    expect(out).toContain('<link rel="canonical" href="https://flowboard.example.com/" />')
    expect(out).toContain('content="https://flowboard.example.com/og-image.png"')
    expect(out).toContain('"@type":"WebApplication"')
  })

  it('adds nothing absolute without a site URL', () => {
    expect(transform('')).toBe('<head></head>')
  })

  it('emits robots.txt always, and sitemap.xml only with a site URL', () => {
    const emitted = (url: string) => {
      const files: Record<string, string> = {}
      const hook = seo(url).generateBundle as unknown as (this: { emitFile: (f: { fileName: string; source: string }) => void }) => void
      hook.call({ emitFile: (f) => (files[f.fileName] = f.source) })
      return files
    }
    expect(Object.keys(emitted(''))).toEqual(['robots.txt'])
    const withUrl = emitted('https://flowboard.example.com')
    expect(withUrl['robots.txt']).toContain('Sitemap: https://flowboard.example.com/sitemap.xml')
    expect(withUrl['sitemap.xml']).toContain('<loc>https://flowboard.example.com/</loc>')
  })
})

describe('colour contrast of form control borders (WCAG 1.4.11)', () => {
  const css = read('src/index.css')
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
  const light = tokens(css.match(/^:root\s*\{([^}]*)\}/m)![1])
  const dark = tokens(css.match(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/)![1])

  it.each([
    ['light', light],
    ['dark', dark],
  ])('keeps control borders at 3:1 or more in the %s theme', (_name, theme) => {
    for (const surface of ['surface', 'bg', 'column']) {
      expect(ratio(theme['border-control'], theme[surface]), `${surface}`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('Supabase migrations (row level security)', () => {
  const dir = join(root, 'supabase/migrations')
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')

  it('enables RLS on every table it creates', () => {
    const created = [...sql.matchAll(/create table (?:if not exists )?(public\.\w+)/gi)].map((m) => m[1])
    expect(created.length).toBeGreaterThan(0)
    for (const table of created) expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`, 'i'))
  })

  it('never uses an always-true policy', () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i)
  })

  it('limits card and column access to team members and nothing to signed-out visitors', () => {
    const policies = sql.match(/create policy[^;]+;/gi) ?? []
    const board = policies.filter((p) => /on public\.(cards|columns)/i.test(p))
    expect(board.length).toBe(8)
    for (const policy of board) {
      expect(policy).toMatch(/to authenticated/i)
      expect(policy).toContain('is_team_member()')
    }
    expect(sql).toMatch(/revoke all on public\.cards, public\.columns, public\.team_members from anon/i)
  })

  it('does not let signed-in users change membership', () => {
    expect(sql).toMatch(/revoke all on public\.team_members from authenticated/i)
    expect(sql).toMatch(/grant select on public\.team_members to authenticated/i)
  })
})
