import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

const DISALLOW = ['/api/', '/account', '/login', '/billing/'];

/**
 * robots.txt with both sitemaps declared. Built here instead of robotsTxt() in packages/core, which declares only the main
 * sitemap; the format matches what that helper emits.
 */
export function robotsWithImageSitemap(): Response {
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${site.url}/sitemap.xml`,
    `Sitemap: ${site.url}/sitemap-images.xml`,
  ];
  return new Response(`${lines.join('\n')}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

export const Route = createFileRoute('/robots.txt')({
  server: { handlers: { GET: () => robotsWithImageSitemap() } },
});
