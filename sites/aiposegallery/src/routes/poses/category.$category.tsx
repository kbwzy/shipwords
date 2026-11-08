import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import site from '../../../site.config';
import { Icon } from '~/site/icons';
import { PoseFigure } from '~/site/pose-figure';
import { POSE_CATEGORIES, POSE_CATEGORY_BY_SLUG, posesInCategory } from '~/site/pose-library';

export const Route = createFileRoute('/poses/category/$category')({
  head: ({ params }) => {
    const entry = POSE_CATEGORY_BY_SLUG.get(params.category);
    if (!entry) {
      return pageHead(site, {
        title: 'Category not found | AI Pose Gallery',
        description: 'That pose category is not in the library. Browse all pose references for artists instead.',
        path: `/poses/category/${params.category}`,
        noindex: true,
      });
    }
    const members = posesInCategory(entry.slug);
    return pageHead(site, {
      title: `${entry.title} (${members.length} studies) | AI Pose Gallery`,
      description: entry.shortDescription,
      path: `/poses/category/${entry.slug}`,
      image: `${site.url}${members[0]!.source}`,
      jsonLd: [
        {
          '@type': 'CollectionPage',
          name: entry.title,
          url: `${site.url}/poses/category/${entry.slug}`,
          description: entry.shortDescription,
          isPartOf: { '@type': 'CollectionPage', name: 'Pose reference library', url: `${site.url}/poses` },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: members.length,
            itemListElement: members.map((pose, index) => ({
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
            { '@type': 'ListItem', position: 3, name: entry.title, item: `${site.url}/poses/category/${entry.slug}` },
          ],
        },
      ],
    });
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const entry = POSE_CATEGORY_BY_SLUG.get(category);
  if (!entry) throw notFound();
  const members = posesInCategory(entry.slug);
  const others = POSE_CATEGORIES.filter((candidate) => candidate.slug !== entry.slug);

  return (
    <article className="lib-category">
      <nav className="lib-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/poses">Pose references</Link></li>
          <li aria-current="page">{entry.title}</li>
        </ol>
      </nav>

      <header className="lib-category-head">
        <div className="eyebrow"><span /> CATEGORY</div>
        <h1>{entry.title}</h1>
        <p className="lib-category-lead">{entry.shortDescription}</p>
        <p className="lib-category-count">{members.length} {members.length === 1 ? 'study' : 'studies'} in this category · {categoryIndex(entry.slug)} of {POSE_CATEGORIES.length}</p>
      </header>

      <div className="lib-category-intro">
        {entry.intro.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>)}
      </div>

      <div className="lib-category-grid-poses">
        {members.map((pose) => (
          <Link key={pose.id} to="/poses/$slug" params={{ slug: pose.slug }} className="lib-tile">
            <span className="lib-tile-image"><PoseFigure pose={pose} /></span>
            <span className="lib-tile-caption">
              <strong>{pose.name}</strong>
              <small>{pose.summary}</small>
            </span>
          </Link>
        ))}
      </div>

      <section className="lib-category-cta">
        <div>
          <h2>Generate your own reference in one of these poses</h2>
          <p>Use any study above as the pose input, with or without a photo of the person you have permission to draw.</p>
        </div>
        <Link className="button button-dark" to="/pose-generator">Open the pose studio <Icon name="arrow" className="icon" /></Link>
      </section>

      <section className="lib-category-others">
        <h2>Other categories</h2>
        <ul>
          {others.map((candidate) => {
            const count = posesInCategory(candidate.slug).length;
            return (
              <li key={candidate.slug}>
                <Link to="/poses/category/$category" params={{ category: candidate.slug }}>{candidate.title}</Link>
                <span>{count} {count === 1 ? 'study' : 'studies'} · {candidate.shortDescription}</span>
              </li>
            );
          })}
        </ul>
        <p><Link to="/poses">See every pose reference in the library</Link> · <Link to="/pricing">Pricing</Link></p>
      </section>
    </article>
  );
}

function categoryIndex(slug: string): number {
  return POSE_CATEGORIES.findIndex((entry) => entry.slug === slug) + 1;
}
