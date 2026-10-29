import type { Plugin } from 'vite'

// Adds absolute URLs (canonical, Open Graph image) and emits sitemap.xml and robots.txt.
// Set VITE_SITE_URL (e.g. https://flowboard.example.com) when deploying; without it the absolute tags are skipped.
export function seo(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/+$/, '')
  return {
    name: 'flowboard-seo',
    transformIndexHtml: (html) => {
      const tags = base
        ? [
            `<link rel="canonical" href="${base}/" />`,
            `<meta property="og:url" content="${base}/" />`,
            `<meta property="og:image" content="${base}/og-image.png" />`,
            `<meta name="twitter:image" content="${base}/og-image.png" />`,
            `<script type="application/ld+json">${JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Flowboard',
              url: `${base}/`,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Any',
              description: 'A simple real-time kanban board for small teams.',
            })}</script>`,
          ].join('\n    ')
        : ''
      return html.replace('<!-- %SEO_URLS% -->', tags)
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`,
      })
      if (base) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/</loc></url>\n</urlset>\n`,
        })
      }
    },
  }
}
