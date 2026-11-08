import { createFileRoute } from '@tanstack/react-router';
import { imageSitemapXml } from './sitemap[.]xml';

export const Route = createFileRoute('/sitemap-images.xml')({
  server: { handlers: { GET: () => imageSitemapXml() } },
});
