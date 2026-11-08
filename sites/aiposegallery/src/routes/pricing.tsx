import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Icon } from '~/site/icons';
import { LandingPlans } from '~/site/landing-plans';
import site from '../../site.config';

export const Route = createFileRoute('/pricing')({
  head: () => pageHead(site, {
    title: 'AI Pose Generator Pricing: One-Time Credit Packs | AI Pose Gallery',
    description: 'AI pose generator pricing: one-time credit packs with no subscription. Starter 5 credits $4.99, Studio 15 credits $11.99, Pro 40 credits $28.99.',
    path: '/pricing',
  }),
  component: PricingPage,
});

/** The H1 names the keyword; LandingPlans keeps its own h2, so `page` is off and the H1 exists once. */
function PricingPage() {
  return <section className="pricing-page">
    <div className="pricing-intro">
      <p className="landing-plans__eyebrow">PRICING</p>
      <h1>AI pose generator pricing: <em>one-time credit packs</em></h1>
      <p>The free pose gallery stays open to everyone. Image generations are paid for with credit packs bought once, not a subscription.</p>
    </div>
    <LandingPlans />
    <p><Link to="/" hash="gallery" className="button button-dark">Explore the gallery <Icon name="arrow" className="icon" /></Link></p>
  </section>;
}
