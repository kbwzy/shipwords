import { absoluteUrl, sitemapXml } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';
import { POSES, POSE_CATEGORIES, POSE_VIEWS, POSE_LIBRARY_LAST_MODIFIED, poseViewAlt, poseViewImage } from '~/site/pose-library';

// Register new indexable pages here.
export const PAGES = [
  '/',
  '/privacy',
  '/terms',
  '/acceptable-use',
  '/refunds',
  '/dmca',
  '/pricing',
  '/partners',
  '/pose-generator',
  '/poses',
  ...POSE_CATEGORIES.map((entry) => `/poses/category/${entry.slug}`),
  ...POSES.map((pose) => `/poses/${pose.slug}`),
];

// Pages whose rendered content is generated from the pose library (home gallery, pose hub, categories, pose pages)
// share the library's last content-change date as their lastmod. Legal and policy pages have no honest per-page date,
// so they ship without one rather than a fake deploy timestamp.
const SITEMAP_ENTRIES = PAGES.map((path) =>
  path === '/' || path.startsWith('/poses') ? { path, lastmod: POSE_LIBRARY_LAST_MODIFIED } : { path },
);

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
      GET: () => sitemapXml(site, SITEMAP_ENTRIES),
    },
  },
});
