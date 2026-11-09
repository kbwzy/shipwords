import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/partners')({
  head: () =>
    pageHead(site, {
      title: `Partners | ${site.name}`,
      description:
        'Directories and launchpads that list AI Pose Gallery. The badges on this page are the reciprocal links those free listings require.',
      path: '/partners',
    }),
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <article className="legal">
      <p className="eyebrow">Featured on</p>
      <h1>Partners</h1>
      <p>
        Directories and launchpads that list AI Pose Gallery. The badges below are required reciprocal links
        for those free listings.
      </p>
      <div className="partner-badges">
        <a href="https://www.toolpilot.ai" rel="dofollow">
          <img
            src="https://www.toolpilot.ai/cdn/shop/files/f-b_690x151_crop_center.png"
            alt="Featured on ToolPilot.ai"
            width={690}
            height={151}
          />
        </a>
        <a href="https://theaitoolsdir.com/product/ai-pose-gallery?ref=badge" rel="dofollow">
          <img
            src="https://theaitoolsdir.com/badge/ai-pose-gallery.svg"
            alt="Featured on TheAIToolsDir"
            width={160}
            height={44}
          />
        </a>
      </div>
    </article>
  );
}
