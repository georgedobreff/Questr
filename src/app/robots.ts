import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/_next/', '/static/'],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'CCBot', 'Omgilibot', 'FacebookBot'],
        allow: '/',
      }
    ],
    sitemap: 'https://questr.gg/sitemap.xml',
  }
}
