import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '~/site/icons';
import { PoseGeneratorPreview, type LibraryPose } from '~/site/pose-generator-preview';
import { LandingPlans } from '~/site/landing-plans';
import { MotionPreview } from '~/site/motion-preview';
import { PoseFigure } from '~/site/pose-figure';
import { POSES, POSE_CATEGORIES, poses as consumerPoses, seriesFor, type Pose, type PoseSeries } from '~/site/pose-library';
import site from '../../site.config';

export const Route = createFileRoute('/')({
  head: () => pageHead(site, {
    title: 'AI Pose References for Artists | AI Pose Gallery',
    description: 'Explore AI-generated figure and yoga pose references for drawing and creative projects. Browse standing, seated, action and yoga studies.',
    path: '/',
    image: `${site.url}/poses/2x/mountain-pose.webp`,
    jsonLd: [{ '@type': 'ImageGallery', name: site.name, url: site.url, description: 'A collection of AI-generated figure and yoga pose references for artists.' }],
  }),
  component: GalleryPage,
});

type Series = PoseSeries | 'All series';

/** The gallery reads the shared library: no local copy of the pose table or the sprite-sheet crops. */
const poses = POSES;
/** The generator wants the library's consumer shape, which already carries the resolved crop and series. */
const libraryPoses: LibraryPose[] = [...consumerPoses];
const categories = ['All poses', 'Fashion', 'Standing', 'Seated', 'Action', 'Balancing', 'Floor poses', 'Upper body'] as const;
const seriesList: Series[] = ['All series', 'Full body · Standard', 'Full body · Sensual / fashion', 'Upper body · Solo'];
type Filter = typeof categories[number];

function Sprite({ pose, className = '' }: { pose: Pose; className?: string }) {
  return <PoseFigure pose={pose} className={className} />;
}

function GalleryPage() {
  const [filter, setFilter] = useState<Filter>('All poses');
  const [series, setSeries] = useState<Series>('All series');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Pose | null>(null);
  const [choice, setChoice] = useState<LibraryPose | null>(null);
  const search = query.trim().toLowerCase();
  const visible = poses.filter((pose) => (series === 'All series' || seriesFor(pose) === series) && (filter === 'All poses' || pose.category === filter) &&
    [pose.name, pose.category, pose.summary, pose.prompt].some((value) => value.toLowerCase().includes(search)));
  const currentIndex = selected ? visible.findIndex((pose) => pose.id === selected.id) : -1;
  const move = (direction: number) => {
    const next = visible[(currentIndex + direction + visible.length) % visible.length];
    if (next) setSelected(next);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> POSE REFERENCES FOR CREATORS</div>
          <h1>AI pose references<br /><em>for artists.</em></h1>
          <p className="hero-slogan">Find the pose. Bring ideas to life.</p>
          <p>{import.meta.env.VITE_POSE_TRIAL_ENABLED === 'true' ? 'Explore pose references and generate a new pose from your photo with AI. Browsing and downloading the gallery is free; image generations use credits from a one-time pack.' : "Explore figure, movement and yoga references for drawing, character studies and creative inspiration. Start with the free collection and preview what's coming next."}</p>
          <div className="hero-actions"><a className="button button-dark" href="#create">Explore the studio <Icon name="arrow" className="icon" /></a><a href="#pricing">View pricing</a></div>
          <div className="hero-note"><Icon name="mark" className="note-mark" /> For artists, storytellers & curious minds</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-card hero-card-back"><div className="hero-card-image"><Sprite pose={poses.find((pose) => pose.id === 'running')!} /></div><span>FIGURE STUDY</span></div>
          <div className="hero-card hero-card-front"><div className="hero-card-image"><Sprite pose={poses.find((pose) => pose.id === 'look-over-shoulder')!} /></div><span>POSE REFERENCE <b>01 / {poses.length}</b></span></div>
          <div className="hero-stamp">FIND YOUR<br /><strong>next pose.</strong><Icon name="arrow" className="icon" /></div>
        </div>
      </section>
      <nav className="library-strip" aria-label="Pose reference categories">
        <div className="library-strip-inner">
          <span className="library-strip-label">BROWSE BY CATEGORY</span>
          <ul>
            {POSE_CATEGORIES.map((entry) => (
              <li key={entry.slug}>
                <Link to="/poses/category/$category" params={{ category: entry.slug }}>{entry.category}</Link>
              </li>
            ))}
          </ul>
          <p>
            <Link to="/poses">All {poses.length} pose references</Link>
            <Link to="/pose-generator">Pose generator</Link>
            <Link to="/pricing">Pricing</Link>
          </p>
        </div>
      </nav>
      <PoseGeneratorPreview apiMode={import.meta.env.VITE_POSE_TRIAL_ENABLED === 'true' ? 'remote' : 'local'} choice={choice} library={libraryPoses} onChoose={setChoice} />
      <LandingPlans />
      <div className="ticker" aria-hidden="true"><span>POSE REFERENCES</span><Icon name="mark" className="ticker-mark" /><span>CREATIVE INSPIRATION</span><Icon name="mark" className="ticker-mark" /><span>MADE TO EXPLORE</span><Icon name="mark" className="ticker-mark" /><span>POSE REFERENCES</span></div>
      <section id="gallery" className="gallery-section">
        <div className="section-heading"><div><div className="eyebrow"><span /> THE COLLECTION</div><h2>Find your <em>next pose.</em></h2><p>Explore solo studies, from everyday gestures to expressive poses.</p></div><div className="collection-mark"><strong>{poses.length}</strong><span>POSE STUDIES<br />IN THE LIBRARY</span></div></div>
        <div className="collection-motion"><div><div className="eyebrow"><span /> MOTION EXPLORATION</div><h3>See a pose <em>in motion.</em></h3><p>A look at an experimental AI-generated clip.</p></div><MotionPreview /></div>
        <div className="series-filter" aria-label="Filter by pose series">
          {seriesList.map((item) => <button key={item} type="button" className={series === item ? 'series-option active' : 'series-option'} aria-pressed={series === item} onClick={() => { setSeries(item); setFilter('All poses'); }}><span>{item}</span><small>{item === 'All series' ? poses.length : poses.filter((pose) => seriesFor(pose) === item).length} studies</small></button>)}
        </div>
        <div className="gallery-controls">
          <div className="filter-list" aria-label="Filter poses by category">
            {categories.map((category) => <button key={category} type="button" className={filter === category ? 'filter active' : 'filter'} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}
          </div>
          <label className="search-box"><Icon name="search" className="icon" /><span className="sr-only">Search poses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search poses..." type="search" /></label>
        </div>
        <div className="gallery-meta"><span aria-live="polite">{visible.length} {visible.length === 1 ? 'pose' : 'poses'} to explore</span><span>AI-GENERATED STUDIES · SELECT TO VIEW</span></div>
        {visible.length ? <div className="pose-grid">{visible.map((pose) => <div className="pose-card-wrap" key={pose.id}>
          <Link to="/poses/$slug" params={{ slug: pose.slug }} className="pose-card" aria-label={`${pose.name}: open the full pose reference`}>
            <div className="pose-card-image"><Sprite pose={pose} /><span className="card-number">{String(poses.indexOf(pose) + 1).padStart(2, '0')}</span><span className="card-arrow"><Icon name="arrow" className="icon" /></span></div>
            <div className="pose-card-caption"><div><strong>{pose.name}</strong><small>{pose.category}</small></div><Icon name="arrow" className="caption-arrow" /></div>
          </Link>
          <p className="pose-card-summary">{pose.summary}</p>
          <button type="button" className="pose-card-preview" onClick={() => setSelected(pose)} aria-label={`Preview ${pose.name} without leaving the page`}>Quick view</button>
        </div>)}</div> : <div className="empty-state"><strong>No poses found.</strong><p>Try a different word or view the whole collection.</p><button type="button" onClick={() => { setQuery(''); setFilter('All poses'); setSeries('All series'); }}>Clear filters</button></div>}
      </section>
      <section id="how-it-works" className="how-section"><div className="how-heading"><div className="eyebrow"><span /> A SIMPLE CREATIVE RITUAL</div><h2>From reference<br />to <em>your own idea.</em></h2><p>Use these AI-generated studies to explore a silhouette, plan a composition or spark a character. Yoga studies are visual references, not instruction.</p></div><div className="steps"><div><span>01</span><h3>Find a pose</h3><p>Browse the collection or search for the gesture you have in mind.</p></div><div><span>02</span><h3>Take a closer look</h3><p>Open a study to see the details and a ready-to-use pose description.</p></div><div><span>03</span><h3>Make it yours</h3><p>Download the reference or copy the prompt into your own creative workflow.</p></div></div></section>
      <section className="closing"><Icon name="mark" className="closing-mark" /><p>EVERY IDEA STARTS SOMEWHERE</p><h2>Let's make something <em>move.</em></h2><a className="button button-dark" href="#gallery">Back to the gallery <Icon name="arrow" className="icon" /></a></section>
      {selected && <PoseDialog pose={selected} index={currentIndex} count={visible.length} onClose={() => setSelected(null)} onMove={move} onUse={() => { setChoice(libraryPoses.find((entry) => entry.id === selected.id) ?? null); setSelected(null); requestAnimationFrame(() => document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })); }} />}
    </>
  );
}

function PoseDialog({ pose, index, count, onClose, onMove, onUse }: { pose: Pose; index: number; count: number; onClose: () => void; onMove: (direction: number) => void; onUse: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  useEffect(() => { setStatus(''); }, [pose.id]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') onClose();
    if (event.key === 'ArrowLeft' && count > 1) onMove(-1);
    if (event.key === 'ArrowRight' && count > 1) onMove(1);
    if (event.key === 'Tab') {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(pose.prompt); setStatus('Prompt copied.'); }
    catch { setStatus('Could not copy automatically. Select the prompt text to copy it.'); }
  }
  function download() {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const { x, y, width, height } = pose;
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) { setStatus('Download is unavailable in this browser.'); return; }
      try { context.drawImage(image, x, y, width, height, 0, 0, width, height); } catch { setStatus('Download failed. Please try again.'); return; }
      try { canvas.toBlob((blob) => {
        if (!blob) { setStatus('Download failed. Please try again.'); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `ai-pose-gallery-${pose.id}.png`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('Reference downloaded.');
      }, 'image/png'); } catch { setStatus('Download failed. Please try again.'); }
    };
    image.onerror = () => setStatus('Download failed. Please try again.');
    image.src = pose.source;
  }
  return <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={handleKey}>
    <div className="pose-dialog" role="dialog" aria-modal="true" aria-labelledby="pose-dialog-title">
      <button ref={closeButton} className="dialog-close" type="button" onClick={onClose} aria-label="Close pose details"><Icon name="close" className="icon" /></button>
      <div className="dialog-image"><Sprite pose={pose} /></div>
      <div className="dialog-content"><div className="eyebrow"><span /> POSE STUDY {String(poses.indexOf(pose) + 1).padStart(2, '0')}</div><h2 id="pose-dialog-title">{pose.name}</h2><p>{pose.summary}</p><span className="dialog-tag">{pose.category}</span><div className="prompt-block"><span>POSE PROMPT</span><p>{pose.prompt}</p></div><div className="dialog-actions"><button className="button button-dark" type="button" onClick={onUse}>Use this pose</button><button className="button button-outline" type="button" onClick={download}><Icon name="download" className="icon" /> Download PNG</button><button className="button button-outline" type="button" onClick={() => void copyPrompt()}><Icon name="copy" className="icon" /> Copy prompt</button></div><p className="dialog-status" aria-live="polite">{status || `AI-generated reference · ${pose.width} × ${pose.height} px`}</p><div className="dialog-navigation"><span>{index + 1} / {count}</span><div><button type="button" disabled={count <= 1} onClick={() => onMove(-1)} aria-label="Previous pose"><Icon name="previous" className="icon" /></button><button type="button" disabled={count <= 1} onClick={() => onMove(1)} aria-label="Next pose"><Icon name="next" className="icon" /></button></div></div></div>
    </div>
  </div>;
}
