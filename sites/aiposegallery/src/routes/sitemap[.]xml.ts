import { absoluteUrl, sitemapXml } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';
import { POSES, POSE_CATEGORIES, POSE_VIEWS, poseViewAlt, poseViewImage } from '~/site/pose-library';

// Register new indexable pages here.
export const PAGES = [
  '/',
  '/privacy',
  '/terms',
  '/acceptable-use',
  '/refunds',
  '/dmca',
  '/pricing',
  '/pose-generator',
  '/poses',
  ...POSE_CATEGORIES.map((entry) => `/poses/category/${entry.slug}`),
  ...POSES.map((pose) => `/poses/${pose.slug}`),
];

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Pose pages as an image sitemap. Every pose page lists all three of its camera angles, so each photograph is discoverable
 * on its own with its own title and caption. Built here rather than in packages/core, which has no image support.
 */
export function imageSitemapXml(): Response {
  const urls = POSES.map((pose) => {
    const images = POSE_VIEWS.map((view) => {
      const title = view === 'hero' ? pose.title : `${pose.category} pose reference (alternate study ${view === 'side' ? '1' : '2'})`;
      return [
        '    <image:image>',
        `      <image:loc>${escapeXml(absoluteUrl(site, poseViewImage(pose.id, view)))}</image:loc>`,
        `      <image:title>${escapeXml(title)}</image:title>`,
        `      <image:caption>${escapeXml(poseViewAlt(pose, view))}</image:caption>`,
        '    </image:image>',
      ].join('\n');
    });
    return [
      '  <url>',
      `    <loc>${escapeXml(absoluteUrl(site, `/poses/${pose.slug}`))}</loc>`,
      ...images,
      '  </url>',
    ].join('\n');
  });
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    '</urlset>',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        sitemapXml(
          site,
          PAGES.map((path) => ({ path })),
        ),
    },
  },
});
