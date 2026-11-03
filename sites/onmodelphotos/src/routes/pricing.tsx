import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Icon } from '~/site/icons';
import { LandingPlans } from '~/site/landing-plans';
import site from '../../site.config';

export const Route = createFileRoute('/pricing')({
  head: () => pageHead(site, {
    title: 'Pricing | OnModel Photos',
    description: 'Browse garment references and generate AI images with one-time credit packs. No subscription.',
    path: '/pricing',
    noindex: true,
  }),
  component: PricingPage,
});

function PricingPage() {
  return <section className="pricing-page">
    <LandingPlans page />
    <p><Link to="/" hash="gallery" className="button button-dark">Explore the gallery <Icon name="arrow" className="icon" /></Link></p>
  </section>;
}
