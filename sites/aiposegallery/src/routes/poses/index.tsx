import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link } from '@tanstack/react-router';
import site from '../../../site.config';
import { Icon } from '~/site/icons';
import { PoseFigure } from '~/site/pose-figure';
import { POSES, POSE_CATEGORIES, posesInCategory } from '~/site/pose-library';

export const Route = createFileRoute('/poses/')({
  head: () => pageHead(site, {
    title: `${POSES.length} Pose References for Drawing and Character Work | AI Pose Gallery`,
    description: `Browse ${POSES.length} AI-generated pose references for artists, grouped into seven categories from standing and seated studies to action, balancing and upper-body portraits.`,
    path: '/poses',
    image: `${site.url}/poses/2x/mountain-pose.webp`,
    jsonLd: [
      {
        '@type': 'CollectionPage',
        name: 'Pose reference library',
        url: `${site.url}/poses`,
        description: `${POSES.length} AI-generated pose references for drawing, character design and costume studies.`,
        isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: POSES.length,
          itemListElement: POSES.map((pose, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: pose.name,
            url: `${site.url}/poses/${pose.slug}`,
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Pose references', item: `${site.url}/poses` },
        ],
      },
    ],
  }),
  component: PoseLibraryIndex,
});

function PoseLibraryIndex() {
  return (
    <>
      <section className="lib-hero">
        <div className="eyebrow"><span /> THE POSE LIBRARY</div>
        <h1>Pose references for drawing, grouped by how the body works</h1>
        <p className="lib-hero-lead">
          Every study in the collection has its own page: the figure at full size, the notes on where the weight sits, and
          the description used to generate it. Start with a category, or scan the full index below.
        </p>
        <div className="lib-hero-actions">
          <Link className="button button-dark" to="/pose-generator">Generate a pose from your photo <Icon name="arrow" className="icon" /></Link>
          <Link className="button button-outline" to="/">Back to the gallery</Link>
        </div>
      </section>

      <section className="lib-categories">
        <h2>Seven categories</h2>
        <div className="lib-category-grid">
          {POSE_CATEGORIES.map((entry) => {
            const members = posesInCategory(entry.slug);
            return (
              <Link key={entry.slug} className="lib-category-card" to="/poses/category/$category" params={{ category: entry.slug }}>
                <span className="lib-category-image"><PoseFigure pose={members[0]!} /></span>
                <span className="lib-category-body">
                  <strong>{entry.title}</strong>
                  <small>{members.length} {members.length === 1 ? 'study' : 'studies'}</small>
                  <span>{entry.shortDescription}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="lib-index">
        <h2>All {POSES.length} pose references</h2>
        {POSE_CATEGORIES.map((entry) => (
          <div key={entry.slug} className="lib-index-group">
            <h3>
              <Link to="/poses/category/$category" params={{ category: entry.slug }}>{entry.title}</Link>
            </h3>
            <ul>
              {posesInCategory(entry.slug).map((pose) => (
                <li key={pose.id}>
                  <Link to="/poses/$slug" params={{ slug: pose.slug }}>{pose.name}</Link>
                  <span>{pose.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="lib-note">
        <p>
          These are AI-generated studies of a single clothed adult figure. The yoga-derived references show shapes to draw,
          not movements to follow. Browse the whole collection here, or read the category notes on each page for the
          drawing problems that shape suits.
        </p>
        <p>
          <Link to="/pose-generator">Pose generator</Link> · <Link to="/pricing">Pricing</Link> · <Link to="/">Gallery home</Link>
        </p>
      </section>
    </>
  );
}
