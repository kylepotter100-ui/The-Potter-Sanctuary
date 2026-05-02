module.exports = {
  siteUrl: 'https://www.thepottersanctuary.co.uk',
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
