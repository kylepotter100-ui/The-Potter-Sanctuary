module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thepottersanctuary.co.uk',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: ['/admin', '/admin/*', '/auth/*', '/api/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/auth', '/api'],
      },
    ],
  },
}
