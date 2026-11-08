import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useCheckout } from '@shipwords/core/react/account';
import type { Product } from '@shipwords/core/site';
import { authClient } from '~/lib/auth';
import { track } from '~/lib/track';
import { m } from '~/paraglide/messages.js';
import { openSignIn } from '~/site/sign-in';
import site from '../../site.config';
import { formatPrice, RESUME_PATH } from './pricing';
import './landing-plans.css';

function describe(product: Product) {
  if (product.kind === 'subscription') {
    return m.common_plan_subscription({ credits: product.creditsPerPeriod.toLocaleString(), interval: product.interval });
  }
  return product.expiresDays
    ? m.common_plan_credits_expiring({ credits: product.credits.toLocaleString(), days: product.expiresDays })
    : m.common_plan_credits({ credits: product.credits.toLocaleString() });
}

/** Three one-time credit packs with an 18+ gate; signed-out users sign in first. */
export function LandingPlans({ page = false }: { page?: boolean }) {
  const Heading = page ? 'h1' : 'h2';
  const [adult, setAdult] = useState(false);
  const root = getRouteApi('__root__');
  const config = root.useLoaderData() as unknown as { googleClientId?: string | null } | undefined;
  const session = authClient(config?.googleClientId ?? null).useSession();
  const { checkout, pending, error } = useCheckout();

  function buy(productId: string) {
    const start = () => {
      track('checkout_start', { product: productId, source: page ? 'pricing_page' : 'pricing_section' });
      void checkout(productId, RESUME_PATH);
    };
    if (session.data) start();
    else openSignIn(start, 'checkout');
  }

  return (
    <section className={`landing-plans${page ? ' landing-plans--page' : ''}`} id="pricing" aria-labelledby="landing-pricing-title">
      <div className="landing-plans__heading">
        <p className="landing-plans__eyebrow">CURRENT PRICING</p>
        <Heading id="landing-pricing-title">Pick your <em>pack.</em></Heading>
        <p>One-time credit packs for image generation. Browsing and downloading the pose gallery is free; image generations use credits from a pack you buy once.</p>
      </div>
      <div className="landing-plans__cards">
        {site.products.map((product) => (
          <article key={product.id} className="landing-plans__card">
            <p className="landing-plans__card-name">{product.name}</p>
            <p className="landing-plans__credits">{product.kind === 'credits' ? product.credits : product.creditsPerPeriod}<span> credits</span></p>
            <p className="landing-plans__price">{formatPrice(product)}</p>
            <p className="landing-plans__description">{describe(product)}</p>
            <button
              type="button"
              className="landing-plans__select"
              disabled={!adult || pending !== null}
              onClick={() => buy(product.id)}
            >
              {pending === product.id ? m.common_plan_redirecting() : m.common_plan_buy()}
            </button>
          </article>
        ))}
      </div>
      <div className="landing-plans__details">
        <p>Generation requires an adult user and permission to use any uploaded images. Purchases open a secure Waffo checkout in a new tab.</p>
        <label className="landing-plans__age">
          <input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} />
          I am 18 or older, and everyone pictured is an adult.
        </label>
        <p>{m.common_pay_fine()} <Link to="/refunds" target="_blank" rel="noopener">{m.common_pay_refund_policy()}</Link></p>
        <Link to="/" hash="create">Try image generation first →</Link>
        {!page && <Link to="/pricing">View pricing page →</Link>}
      </div>
      {error && <p className="landing-plans__error" role="alert">{error}</p>}
    </section>
  );
}
