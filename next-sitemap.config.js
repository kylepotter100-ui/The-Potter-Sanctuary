// Sitemap + robots.txt, generated on postbuild. The canonical host is the apex
// (CLAUDE.md rule 4) — preview hosts additionally send X-Robots-Tag: noindex.
const PRIVATE = ['/admin', '/admin/*', '/auth/*', '/api/*', '/account', '/account/*', '/login', '/review', '/questionnaire']

module.exports = {
  siteUrl: 'https://thepottersanctuary.co.uk',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: PRIVATE,
  transform: async (config, path) => ({
    loc: path,
    changefreq: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1.0 : path.startsWith('/services/') ? 0.9 : 0.3,
    lastmod: new Date().toISOString(),
  }),
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        // Personal pages are also noindex; disallowing keeps crawlers from
        // spending time on them. /login stays crawlable so its noindex is seen.
        disallow: ['/admin', '/auth', '/api', '/account', '/questionnaire', '/review'],
      },
    ],
  },
}
