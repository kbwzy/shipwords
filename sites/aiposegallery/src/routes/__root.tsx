import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { analyticsScripts } from '@shipwords/core/analytics';
import type { ReactNode } from 'react';
import { getLocale } from '~/paraglide/runtime.js';
import { getPublicConfig } from '~/lib/public-config';
import { authClient } from '~/lib/auth';
import { m } from '~/paraglide/messages.js';
import { SUPPORT_EMAIL } from '~/site/legal';
import { Icon } from '~/site/icons';
import { AccountDialog, AccountLink } from '~/site/account';
import { PricingDialog } from '~/site/pricing';
import { openSignIn, SignInDialog } from '~/site/sign-in';
import appCss from '~/site/styles.css?url';
import site from '../../site.config';

export const Route = createRootRoute({
  loader: () => getPublicConfig(),
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg?v=3', type: 'image/svg+xml' },
    ],
    scripts: import.meta.env.DEV ? [] : analyticsScripts(site),
  }),
  shellComponent: Document,
  component: Layout,
  notFoundComponent: NotFound,
});

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function Layout() {
  const config = Route.useLoaderData() as unknown as { googleClientId?: string | null } | undefined;
  const session = authClient(config?.googleClientId ?? null).useSession();
  const user = session.data?.user;
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="AI Pose Gallery home">
          <Icon name="mark" className="brand-mark" />
          <span>pose<span className="brand-light">gallery</span><small>AI REFERENCE LIBRARY</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="/#gallery">Explore poses</a>
          <a href="/#how-it-works">How to use</a>
          <Link to="/pricing" className="nav-plans">Pricing</Link>
          <a className="nav-button" href="/#create">Explore the studio <Icon name="arrow" className="icon" /></a>
          {user ? (
            <AccountLink className="avatar" title={user.email}>
              {user.image ? (
                <img src={user.image} alt="" referrerPolicy="no-referrer" />
              ) : (
                (user.name || user.email).slice(0, 1).toUpperCase()
              )}
            </AccountLink>
          ) : (
            <a
              className="nav-signin"
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                openSignIn();
              }}
            >
              {m.common_nav_sign_in()}
            </a>
          )}
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">
        <div><span className="footer-brand"><Icon name="mark" className="footer-mark" /> posegallery</span><p>A little more reference, a little less guesswork.</p></div>
        <div className="footer-links">
          <Link to="/pricing">Pricing</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
          <Link to="/acceptable-use">Acceptable use</Link><Link to="/refunds">Refunds</Link><Link to="/dmca">DMCA</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
        </div>
        <p className="footer-bottom">© {new Date().getFullYear()} AI Pose Gallery. Made for curious creators.</p>
      </footer>
      <PricingDialog />
      <SignInDialog />
      <AccountDialog />
    </div>
  );
}

function NotFound() {
  return <section className="legal"><title>Page not found — AI Pose Gallery</title><meta name="robots" content="noindex" /><h1>Page not found</h1><p>That page may have moved.</p><Link to="/">Back to the gallery →</Link></section>;
}
