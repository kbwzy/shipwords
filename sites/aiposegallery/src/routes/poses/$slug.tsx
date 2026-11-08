import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import site from '../../../site.config';
import { Icon } from '~/site/icons';
import { PoseFigure } from '~/site/pose-figure';
import { PoseDownload } from '~/site/pose-detail-actions';
import {
  POSES,
  POSE_BY_ID,
  POSE_CATEGORY_BY_SLUG,
  poseViewAlt,
  poseViewImage,
  poseViewImage2x,
  posesInCategory,
  type Pose,
  type PoseCategoryEntry,
} from '~/site/pose-library';

/** Category slug a pose is filed under, so links, breadcrumbs and the sitemap all agree. */
export function categoryOf(pose: Pose): PoseCategoryEntry {
  const match = [...POSE_CATEGORY_BY_SLUG.values()].find((entry) => entry.category === pose.category);
  if (!match) throw new Error(`No category entry for ${pose.category}`);
  return match;
}

export function posePath(pose: Pose): string {
  return `/poses/${pose.slug}`;
}

export function categoryPath(entry: PoseCategoryEntry): string {
  return `/poses/category/${entry.slug}`;
}

export const Route = createFileRoute('/poses/$slug')({
  loader: ({ params }) => { if (!POSE_BY_ID.has(params.slug)) throw notFound(); },
  notFoundComponent: () => <PoseNotFound slug="" />,
  head: ({ params }) => {
    const pose = POSE_BY_ID.get(params.slug);
    if (!pose) {
      return pageHead(site, {
        title: 'Pose not found | AI Pose Gallery',
        description: 'That pose reference is not in the library. Browse every pose reference for artists in the free gallery.',
        path: `/poses/${params.slug}`,
        noindex: true,
      });
    }
    const category = categoryOf(pose);
    const position = POSES.findIndex((entry) => entry.id === pose.id) + 1;
    return pageHead(site, {
      title: pose.title,
      description: pose.summary,
      path: posePath(pose),
      image: `${site.url}${pose.source}`,
      jsonLd: [
        {
          '@type': 'ImageObject',
          '@id': `${site.url}${posePath(pose)}#reference`,
          name: pose.name,
          description: pose.summary,
          contentUrl: `${site.url}${pose.source}`,
          thumbnailUrl: `${site.url}${pose.source}`,
          caption: pose.alt,
          keywords: pose.tags.join(', '),
          representativeOfPage: true,
          isPartOf: { '@type': 'ImageGallery', name: site.name, url: `${site.url}/poses` },
          encodingFormat: 'image/webp',
          position,
          about: { '@type': 'Thing', name: `${pose.category} pose reference` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
            { '@type': 'ListItem', position: 2, name: 'Pose references', item: `${site.url}/poses` },
            { '@type': 'ListItem', position: 3, name: category.title, item: `${site.url}${categoryPath(category)}` },
            { '@type': 'ListItem', position: 4, name: pose.name, item: `${site.url}${posePath(pose)}` },
          ],
        },
      ],
    });
  },
  component: PosePage,
});

function PosePage() {
  const { slug } = Route.useParams();
  const pose = POSE_BY_ID.get(slug);
  if (!pose) return <PoseNotFound slug={slug} />;

  const category = categoryOf(pose);
  const siblings = posesInCategory(category.slug);
  const index = siblings.findIndex((entry) => entry.id === pose.id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  const related = pose.related.map((id) => POSE_BY_ID.get(id)).filter((entry): entry is Pose => Boolean(entry));

  return (
    <article className="lib-pose">
      <nav className="lib-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/poses">Pose references</Link></li>
          <li><Link to="/poses/category/$category" params={{ category: category.slug }}>{category.title}</Link></li>
          <li aria-current="page">{pose.name}</li>
        </ol>
      </nav>

      <div className="lib-pose-layout">
        <div className="lib-pose-figures">
          <figure className="lib-pose-stage">
            <div className="lib-pose-stage-frame">
              <PoseFigure pose={{ ...pose, source: poseViewImage(pose.id, 'hero') }} />
            </div>
            <figcaption>
              {poseViewAlt(pose, 'hero')}
              <span>{pose.category} · Reference {String(POSES.findIndex((entry) => entry.id === pose.id) + 1).padStart(2, '0')} of {POSES.length}</span>
              <PoseDownload poseId={pose.id} view="hero" />
            </figcaption>
          </figure>
          <div className="lib-pose-views">
            {(['side', 'back'] as const).map((view) => (
              <figure className="lib-pose-view" key={view}>
                <div className="lib-pose-view-frame">
                  <PoseFigure pose={{ ...pose, source: poseViewImage(pose.id, view) }} alt={poseViewAlt(pose, view)} src2x={poseViewImage2x(pose.id, view)} />
                </div>
                <figcaption>{view === 'side' ? 'Alternate study 1' : 'Alternate study 2'} <PoseDownload poseId={pose.id} view={view} /></figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="lib-pose-copy">
          <div className="eyebrow"><span /> {pose.category.toUpperCase()} POSE REFERENCE</div>
          <h1>{pose.name}</h1>
          <p className="lib-pose-summary">{pose.summary}</p>
          {pose.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>)}
          <ul className="lib-pose-tags" aria-label="Pose keywords">
            {pose.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        </div>
      </div>

      <div className="lib-pose-details">
        <section className="lib-panel">
          <h2>Drawing notes</h2>
          <ul className="lib-tips">
            {pose.drawingTips.map((tip) => <li key={tip.slice(0, 32)}>{tip}</li>)}
          </ul>
        </section>

        <section className="lib-panel">
          <h2>Pose prompt</h2>
          <p className="lib-panel-lead">The description used to generate this study. Copy it into your own workflow, or hand it to the studio with your photo.</p>
          <p className="lib-prompt">{pose.prompt}</p>
          {pose.promptNotes.length > 0 && (
            <>
              <h3>Working notes</h3>
              <ul className="lib-notes">{pose.promptNotes.map((note) => <li key={note.slice(0, 32)}>{note}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="lib-pose-cta">
        <div>
          <div className="eyebrow"><span /> MAKE IT YOURS</div>
          <h2>Put this pose on your own reference</h2>
          <p>Take this study to the studio and generate a new image in the same pose, or browse the rest of the {category.category.toLowerCase()} studies first.</p>
        </div>
        <div className="lib-cta-actions">
          <Link className="button button-dark" to="/pose-generator" search={{ pose: pose.id }} hash="create">Open the pose studio <Icon name="arrow" className="icon" /></Link>
          <Link className="button button-outline" to="/poses/category/$category" params={{ category: category.slug }}>All {category.title.toLowerCase()} <Icon name="arrow" className="icon" /></Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="lib-related">
          <h2>Related pose references</h2>
          <div className="lib-related-grid">
            {related.map((entry) => (
              <Link key={entry.id} to="/poses/$slug" params={{ slug: entry.slug }} className="lib-related-card">
                <span className="lib-related-image"><PoseFigure pose={entry} /></span>
                <span className="lib-related-caption"><strong>{entry.name}</strong><small>{entry.category}</small></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="lib-pose-nav" aria-label="More poses in this category">
        {previous
          ? <Link to="/poses/$slug" params={{ slug: previous.slug }}><Icon name="previous" className="icon" /> {previous.name}</Link>
          : <span />}
        {next
          ? <Link to="/poses/$slug" params={{ slug: next.slug }}>{next.name} <Icon name="next" className="icon" /></Link>
          : <span />}
      </nav>
    </article>
  );
}

function PoseNotFound({ slug }: { slug: string }) {
  return (
    <section className="lib-notfound">
      <title>Pose not found | AI Pose Gallery</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="eyebrow"><span /> NOT IN THE LIBRARY</div>
      <h1>That pose is not in the library</h1>
      <p>{slug ? <>There is no pose reference filed under <code>{slug}</code>. </> : null}Every study in the collection has its own page; start from the library index.</p>
      <p><Link to="/poses">Browse all pose references</Link></p>
    </section>
  );
}
