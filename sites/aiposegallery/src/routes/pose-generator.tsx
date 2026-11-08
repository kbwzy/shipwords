import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { selectedLibraryPose } from '~/site/pose-detail-actions';
import { formatPrice } from '~/site/pricing';
import { poses as libraryPoses } from '~/site/pose-library';
import { PoseGeneratorPreview, type LibraryPose } from '~/site/pose-generator-preview';
import site from '../../site.config';
import './pose-generator.css';

/** Consumer array from the library: all 67 studies with crops resolved and `series` already computed there. */
const LIBRARY: LibraryPose[] = [...libraryPoses];
const POSE_COUNT = LIBRARY.length;

const FAQ = [
  {
    q: 'What is an AI pose generator?',
    a: 'It is a tool that makes a new image of a person in a pose you choose. You give it one of two things on its own, or both together: a photo of one real person you have permission to use, and a pose reference from the library (or in words). With both, the person from the photo is redrawn in the new pose. With a pose reference alone, the generator invents a new figure that takes that pose.',
  },
  {
    q: 'How is this different from a 3D pose reference generator?',
    a: 'A 3D poser such as Quickposes, JustSketchMe or SetPose gives you a mannequin that you rotate by hand with sliders and joint handles, then draw from. Nothing is generated. Here you do not build a skeleton at all: you hand over a photo and receive a finished, lit image of that person in the new pose. The trade is control for speed, and the result is a picture rather than a model you can keep turning.',
  },
  {
    q: 'What does the pose library cost?',
    a: `Nothing. Browsing all ${POSE_COUNT} pose studies, opening a study, copying its written pose description and downloading its images are free and need no account. A limited guest generation trial may also be available; paid generations use credits.`,
  },
  {
    q: 'What does one credit buy, and what does a pack cost?',
    a: 'One credit covers one paid image generation request. If the request fails before submission to the image provider, we work to return the credit; contact support if it has not been returned. Once submitted, a credit may be used even if a result is not delivered. Packs are bought once: Starter is 5 credits for $4.99, Studio is 15 credits for $11.99 and Pro is 40 credits for $28.99. There is no subscription, nothing renews automatically and unused credits do not expire.',
  },
  {
    q: 'What photo should I upload?',
    a: 'One adult, fully clothed, on their own in the frame, well lit, with the whole body visible if you want a full-body pose. JPEG, PNG or WebP up to 10 MB. Crop out anyone else first: requests that ask for more than one person are rejected before a credit is spent. If you want a new figure instead of a specific person, skip the photo entirely.',
  },
  {
    q: 'Can I use a real person\'s photo, or make a deepfake?',
    a: 'Only with that person\'s permission, and only for that person. Face swapping, impersonation and synthetic images meant to look like real events are not allowed. Output is AI-generated and must not be presented as a real photograph. Nudity, sexualized poses, minors, violence and hateful imagery are refused, and requests are screened before they are rendered.',
  },
  {
    q: 'Can it generate video?',
    a: 'No. Video is not available: the format switch exists in the workspace, but selecting it disables generation and says so. Image generation is the only format that produces a result today.',
  },
  {
    q: 'Where do my photo and result go, and how long do they stay?',
    a: 'Your photo and pose reference are held in private storage and passed to Yir, the image provider, when you press Generate. Site copies are scheduled to expire after one day and deletion can lag behind that. Access to your result depends on a session cookie that lasts 24 hours, so download the image before then. Full details are in the privacy policy.',
  },
];

const STEPS = [
  { n: '01', title: 'Upload one photo', body: 'A single adult, fully clothed, with permission to use the image. Skip this step if you want a new figure rather than a specific person.' },
  { n: '02', title: 'Choose the pose', body: `Open the library and pick one of the ${POSE_COUNT} pose studies, or describe the pose in the instructions field if nothing in the library fits.` },
  { n: '03', title: 'Generate the new pose', body: 'The person from your photo is redrawn in the new pose with their face, build and clothing carried over as far as the model allows. Download the result, or swap the pose and run it again.' },
];

const LIMITS = [
  'One person per request. Instructions that describe two people or a group are rejected.',
  'One photo plus one pose reference, 10 MB each. No batch uploads and no queue.',
  'Identity, clothing and background are preserved as far as the model manages them, not pixel for pixel.',
  'No video, no face swap, no nudity, no minors, no real people without permission.',
  'Credits for requests that fail before submission may be returned; contact support if a credit has not been returned. Stopping tracking does not cancel a request. Your photo passes through a third-party provider.',
];

/** No machine-readable aggregate rating exists, so none is claimed. */
const structuredData = [
  {
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
  {
    '@type': 'WebApplication',
    name: 'AI pose generator',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Any',
    url: `${site.url}/pose-generator`,
    description: 'Turn a photo into a new pose, or generate a new figure from a pose reference.',
    offers: site.products
      .filter((product) => product.kind === 'credits')
      .map((product) => ({ '@type': 'Offer', name: product.name, price: (product.price.amount / 100).toFixed(2), priceCurrency: product.price.currency.toUpperCase() })),
  },
];

export const Route = createFileRoute('/pose-generator')({
  validateSearch: (search: { pose?: unknown }): { pose?: string } => ({ pose: typeof search.pose === 'string' ? search.pose : undefined }),
  head: () => pageHead(site, {
    title: 'AI Pose Generator: Turn a Photo Into a New Pose | AI Pose Gallery',
    description: `An AI pose generator that redraws one person from your photo in a pose you choose, or invents a new figure from a pose reference alone. The ${POSE_COUNT}-study pose library is free; image generations use one-time credit packs from $4.99.`,
    path: '/pose-generator',
    image: `${site.url}/pose-edit-example.png`,
    jsonLd: structuredData,
  }),
  component: PoseGeneratorPage,
});

function PoseGeneratorPage() {
  const { pose } = Route.useSearch();
  const [choice, setChoice] = useState<LibraryPose | null>(() => selectedLibraryPose(LIBRARY, pose));
  useEffect(() => { setChoice(selectedLibraryPose(LIBRARY, pose)); }, [pose]);
  const packs = site.products.filter((product) => product.kind === 'credits');
  return (
    <>
      <section className="pg-page-hero">
        <div className="eyebrow"><span /> AI POSE GENERATOR</div>
        <h1>AI pose generator: turn a photo into <em>a new pose</em></h1>
        <p className="pg-page-hero__lead">
          Upload one photo of a person and choose the pose you want. The generator redraws that person in the new pose instead of rotating a 3D mannequin. No photo? Start from a pose reference and get a new figure in that pose.
        </p>
        <div className="pg-page-hero__actions">
          <a className="button button-dark" href="#create">Start with your photo</a>
          <a href="#faq">Read the FAQ</a>
        </div>
        <ul className="pg-page-hero__facts">
          <li><strong>{POSE_COUNT}</strong><span>pose references, free to browse</span></li>
          <li><strong>{packs.length ? formatPrice(packs[0]!) : ''}</strong><span>entry pack, one-time</span></li>
          <li><strong>0</strong><span>subscriptions</span></li>
        </ul>
      </section>

      <PoseGeneratorPreview
        apiMode={import.meta.env.VITE_POSE_TRIAL_ENABLED === 'true' ? 'remote' : 'local'}
        choice={choice}
        library={LIBRARY}
        onChoose={setChoice}
        titleLevel={3}
      />

      <section className="pg-page-section" id="what-it-does">
        <div className="pg-page-section__heading">
          <div className="eyebrow"><span /> WHAT IT ACTUALLY DOES</div>
          <h2>Two inputs. <em>One person.</em></h2>
        </div>
        <div className="pg-page-cards">
          <article>
            <p className="pg-page-cards__label">PHOTO + POSE REFERENCE</p>
            <h3>Keep the person, change the pose</h3>
            <p>The common request. You upload a photo of one person and pick a reference pose. The output is that person, redrawn in the new pose, with the face, frame and clothing carried across as far as the model manages. The photo is what makes it a pose change rather than a new character.</p>
          </article>
          <article>
            <p className="pg-page-cards__label">POSE REFERENCE ONLY</p>
            <h3>Choose the pose, invent the figure</h3>
            <p>Skip the photo and the generator builds a new person, lit and posed, from a reference alone. Useful when you want the gesture for a character sheet and are not tied to a specific face. You can also write the pose in the instructions field instead of picking one.</p>
          </article>
          <article>
            <p className="pg-page-cards__label">TEXT INSTRUCTIONS</p>
            <h3>Optional, up to 2,000 characters</h3>
            <p>Add what should stay or change, in your own words: the outfit, the room, the camera angle. Instructions sit next to the photo and the pose rather than replacing them, and a request still needs at least a pose or a written description.</p>
          </article>
        </div>
        <div className="pg-page-compare">
          <h3>The 3D poser and the AI generator solve different jobs</h3>
          <p>Search for a pose reference generator and most results are 3D mannequin posers. You get a stick figure with an armature, you drag joints until the silhouette looks right, and you draw it yourself. The output is geometry you can keep rotating.</p>
          <p>An AI pose generator removes the building step. You do not manipulate a skeleton; you supply a photo and a target pose and receive a finished picture. That is faster and closer to a final image, and it gives you less control: you cannot spin the result, and the model may drift on hands, faces and fine detail. If you need an angle no photo can show, a 3D poser still wins. If you have a photo and need a different pose of the same person, the generator is the direct route.</p>
        </div>
      </section>

      <section className="pg-page-section" id="how-it-works">
        <div className="pg-page-section__heading">
          <div className="eyebrow"><span /> HOW IT WORKS</div>
          <h2>Three steps, <em>one image.</em></h2>
        </div>
        <ol className="pg-page-steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="pg-page-section" id="library">
        <div className="pg-page-section__heading">
          <div className="eyebrow"><span /> THE POSE LIBRARY</div>
          <h2>{POSE_COUNT} pose studies, <em>ready to reference.</em></h2>
        </div>
        <div className="pg-page-prose">
          <p>The library is {POSE_COUNT} AI-generated pose references, not stock photographs of models. It covers standing and fashion poses, seated and floor poses, action and walking poses, balancing poses and upper-body portraits. Every study carries a written pose description, and selecting one sends it straight into the studio as the pose reference for your generation.</p>
          <p>Browse the full set by category and open a study to download its images as WebP from the <a href="/poses">pose library page</a>. Each study is a single person, fully clothed.</p>
        </div>
      </section>

      <section className="pg-page-section" id="pricing">
        <div className="pg-page-section__heading">
          <div className="eyebrow"><span /> CREDITS</div>
          <h2>Free references, <em>paid generations.</em></h2>
        </div>
        <p className="pg-page-prose">The pose library is free: browsing, opening and downloading references costs nothing and needs no account. A limited guest trial may be available; signed-in image generation uses one credit per request, bought once as a pack. There is no subscription, nothing renews automatically and unused credits do not expire.</p>
        <div className="pg-page-packs">
          {packs.map((product) => (
            <article key={product.id}>
              <p className="pg-page-packs__name">{product.name}</p>
              <p className="pg-page-packs__credits">{product.credits}<span> credits</span></p>
              <p className="pg-page-packs__price">{formatPrice(product)}</p>
              <p className="pg-page-packs__unit">{formatPrice({ ...product, price: { ...product.price, amount: Math.round(product.price.amount / (product.credits || 1)) } })} per generation</p>
            </article>
          ))}
        </div>
        <p className="pg-page-prose">Prices above come from the live site configuration. The full comparison is on the <a href="/pricing">pricing page</a>, and the terms of purchase are in the <a href="/refunds">refund policy</a>.</p>
      </section>

      <section className="pg-page-section pg-page-section--split" id="limits">
        <div>
          <div className="eyebrow"><span /> LIMITS AND RULES</div>
          <h2>What it refuses, <em>and why.</em></h2>
          <p>The generator is deliberately narrow: one adult, fully clothed, one person per request. Requests that break those rules are rejected before an image is rendered. A request that fails before submission may be eligible for a credit return; see the refund policy for details.</p>
        </div>
        <ul className="pg-page-limits">
          {LIMITS.map((limit) => <li key={limit}>{limit}</li>)}
        </ul>
      </section>

      <section className="pg-page-section" id="faq">
        <div className="pg-page-section__heading">
          <div className="eyebrow"><span /> FAQ</div>
          <h2>Questions people <em>actually ask.</em></h2>
        </div>
        <div className="pg-page-faq">
          {FAQ.map((item) => (
            <article key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <nav className="pg-page-more" aria-labelledby="keep-exploring">
        <h2 id="keep-exploring">Keep exploring</h2>
        <div className="pg-page-more__links">
          <a href="/poses">
            <strong>The full pose library</strong>
            <span>All {POSE_COUNT} studies, browsable by category, with downloadable WebP images.</span>
          </a>
          <a href="/pricing">
            <strong>Pricing</strong>
            <span>The three credit packs side by side, with what one credit buys.</span>
          </a>
          <a href="/acceptable-use">
            <strong>Acceptable use</strong>
            <span>The content rules this generator enforces, in full.</span>
          </a>
        </div>
      </nav>

      <section className="pg-page-closing">
        <p className="eyebrow"><span /> READY WHEN YOU ARE</p>
        <h2>Bring a photo. <em>Leave with a pose.</em></h2>
        <div className="pg-page-hero__actions">
          <a className="button button-dark" href="#create">Open the studio</a>
          <a href="/poses">Browse all {POSE_COUNT} poses</a>
        </div>
      </section>
    </>
  );
}
