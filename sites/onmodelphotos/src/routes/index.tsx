import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '~/site/icons';
import { GarmentGeneratorPreview, type LibraryItem } from '~/site/garment-generator-preview';
import { LandingPlans } from '~/site/landing-plans';
import { garments, models } from '~/site/garment-sheet';
import site from '../../site.config';

export const Route = createFileRoute('/')({
  head: () => pageHead(site, {
    title: 'AI On-Model Photos for Your Store | OnModel Photos',
    description: 'Turn a flat-lay garment photo into on-model catalog shots. Upload a product photo, pick a pose, and get e-commerce model images in seconds.',
    path: '/',
    image: `${site.url}/garment-edit-example.jpg`,
    jsonLd: [{ '@type': 'SoftwareApplication', name: site.name, url: site.url, applicationCategory: 'DesignApplication', description: 'Generate AI on-model product photos from flat-lay garment images.' }],
  }),
  component: StudioPage,
});

const library: LibraryItem[] = [
  ...garments.map((garment) => ({
    id: garment.id,
    name: garment.name,
    prompt: garment.prompt,
    category: garment.category,
    series: 'Garments' as const,
    image: garment.image,
  })),
  ...models.map((model) => ({
    id: model.id,
    name: model.name,
    category: 'Model poses',
    series: 'Model poses' as const,
    image: model.image,
  })),
];
const garmentById = new Map(library.map((item) => [item.id, item]));

function Tile({ item, className = '' }: { item: LibraryItem; className?: string }) {
  return <img className={className} src={item.image} alt={item.name} loading="lazy" />;
}

function StudioPage() {
  const [filter, setFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const [garment, setGarment] = useState<LibraryItem | null>(null);
  const [model, setModel] = useState<LibraryItem | null>(null);
  const search = query.trim().toLowerCase();
  const categories = ['All', ...new Set(library.map((item) => item.category))];
  const visible = library.filter((item) => (filter === 'All' || item.category === filter) &&
    [item.name, item.category, item.prompt ?? ''].some((value) => value.toLowerCase().includes(search)));
  const currentIndex = selected ? visible.findIndex((item) => item.id === selected.id) : -1;
  const move = (direction: number) => {
    const next = visible[(currentIndex + direction + visible.length) % visible.length];
    if (next) setSelected(next);
  };
  const pick = (item: LibraryItem | null, slot: 'garment' | 'model') => { if (slot === 'garment') setGarment(item); else setModel(item); };

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> ON-MODEL PHOTOS FOR SELLERS</div>
          <h1>Your garments.<br /><em>On real models.</em></h1>
          <p>{import.meta.env.VITE_GARMENT_TRIAL_ENABLED === 'true' ? 'Upload a flat-lay product photo, pick a pose, and get catalog-ready on-model shots in seconds. Every visitor gets 3 free generations each UTC day.' : 'Upload a flat-lay product photo, pick a pose, and get catalog-ready on-model shots in seconds — no photoshoot, no studio.'}</p>
          <div className="hero-actions"><a className="button button-dark" href="#create">Open the studio <Icon name="arrow" className="icon" /></a><a href="#pricing">View pricing</a></div>
          <div className="hero-note"><Icon name="mark" className="note-mark" /> For clothing brands, Etsy & Shopify sellers</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-card hero-card-back"><div className="hero-card-image"><Tile item={garmentById.get('badge-hoodie')!} /></div><span>FLAT LAY</span></div>
          <div className="hero-card hero-card-front"><div className="hero-card-image"><img src="/garment-edit-example.jpg" alt="" /></div><span>ON MODEL <b>AI</b></span></div>
          <div className="hero-stamp">FLAT LAY TO<br /><strong>on-model.</strong><Icon name="arrow" className="icon" /></div>
        </div>
      </section>
      <GarmentGeneratorPreview library={library} garment={garment} model={model} onPick={pick} />
      <LandingPlans />
      <div className="ticker" aria-hidden="true"><span>FLAT LAY TO MODEL</span><Icon name="mark" className="ticker-mark" /><span>CATALOG READY</span><Icon name="mark" className="ticker-mark" /><span>NO PHOTOSHOOT</span><Icon name="mark" className="ticker-mark" /><span>FLAT LAY TO MODEL</span></div>
      <section id="gallery" className="gallery-section">
        <div className="section-heading"><div><div className="eyebrow"><span /> THE LIBRARY</div><h2>Start from a <em>reference.</em></h2><p>Garment examples the studio can reproduce, and model poses to place them in.</p></div><div className="collection-mark"><strong>{library.length}</strong><span>REFERENCES<br />IN THE LIBRARY</span></div></div>
        <div className="gallery-controls">
          <div className="filter-list" aria-label="Filter references by category">
            {categories.map((category) => <button key={category} type="button" className={filter === category ? 'filter active' : 'filter'} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category === 'All' ? 'All references' : category}</button>)}
          </div>
          <label className="search-box"><Icon name="search" className="icon" /><span className="sr-only">Search references</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search references..." type="search" /></label>
        </div>
        <div className="gallery-meta"><span aria-live="polite">{visible.length} {visible.length === 1 ? 'reference' : 'references'} to explore</span><span>AI-GENERATED EXAMPLES · SELECT TO VIEW</span></div>
        {visible.length ? <div className="garment-grid">{visible.map((item) => <button type="button" className="garment-card" key={item.id} onClick={() => setSelected(item)} aria-label={`View ${item.name}`}>
          <div className="garment-card-image"><Tile item={item} /><span className="card-number">{String(library.indexOf(item) + 1).padStart(2, '0')}</span><span className="card-arrow"><Icon name="plus" className="icon" /></span></div>
          <div className="garment-card-caption"><div><strong>{item.name}</strong><small>{item.category}</small></div><Icon name="arrow" className="caption-arrow" /></div>
        </button>)}</div> : <div className="empty-state"><strong>No references found.</strong><p>Try a different word or view the whole library.</p><button type="button" onClick={() => { setQuery(''); setFilter('All'); }}>Clear filters</button></div>}
      </section>
      <section id="how-it-works" className="how-section"><div className="how-heading"><div className="eyebrow"><span /> THREE STEPS TO CATALOG SHOTS</div><h2>From flat lay<br />to <em>on-model.</em></h2><p>Shoot your garments flat, let AI do the model work. The garment stays faithful — logo, pattern and fabric included.</p></div><div className="steps"><div><span>01</span><h3>Upload your garment</h3><p>A clean flat-lay or ghost-mannequin product photo is all the studio needs.</p></div><div><span>02</span><h3>Pick a model pose</h3><p>Choose a standing, walking or seated pose from the reference library.</p></div><div><span>03</span><h3>Download & list</h3><p>Get a studio-background on-model photo, ready for your product page.</p></div></div></section>
      <section className="closing"><Icon name="mark" className="closing-mark" /><p>NO STUDIO. NO PHOTOSHOOT.</p><h2>List every garment <em>on a model.</em></h2><a className="button button-dark" href="#create">Open the studio <Icon name="arrow" className="icon" /></a></section>
      {selected && <ReferenceDialog item={selected} index={currentIndex} count={visible.length} onClose={() => setSelected(null)} onMove={move} onUse={() => { pick(selected.series === 'Garments' ? selected : null, 'garment'); if (selected.series === 'Model poses') pick(selected, 'model'); setSelected(null); requestAnimationFrame(() => document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })); }} />}
    </>
  );
}

function ReferenceDialog({ item, index, count, onClose, onMove, onUse }: { item: LibraryItem; index: number; count: number; onClose: () => void; onMove: (direction: number) => void; onUse: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  useEffect(() => { setStatus(''); }, [item.id]);

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
  function download() {
    const link = document.createElement('a');
    link.href = item.image;
    link.download = `onmodelphotos-${item.id}.jpg`;
    link.click();
    setStatus('Reference downloaded.');
  }
  return <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={handleKey}>
    <div className="garment-dialog" role="dialog" aria-modal="true" aria-labelledby="garment-dialog-title">
      <button ref={closeButton} className="dialog-close" type="button" onClick={onClose} aria-label="Close reference details"><Icon name="close" className="icon" /></button>
      <div className="dialog-image"><Tile item={item} /></div>
      <div className="dialog-content"><div className="eyebrow"><span /> REFERENCE {String(library.indexOf(item) + 1).padStart(2, '0')}</div><h2 id="garment-dialog-title">{item.name}</h2><p>{item.prompt ?? (item.series === 'Model poses' ? 'Model reference for body type, skin tone and hair — not clothing.' : 'Garment reference the studio reproduces faithfully.')}</p><span className="dialog-tag">{item.category}</span><div className="prompt-block"><span>EXAMPLE PROMPT</span><p>{item.prompt ?? `Use this ${item.series === 'Model poses' ? 'model reference' : 'garment'} with your product photo.`}</p></div><div className="dialog-actions"><button className="button button-dark" type="button" onClick={onUse}>Use this reference</button><button className="button button-outline" type="button" onClick={download}><Icon name="download" className="icon" /> Download</button></div><p className="dialog-status" aria-live="polite">{status || 'AI-generated reference · demo content'}</p><div className="dialog-navigation"><span>{index + 1} / {count}</span><div><button type="button" disabled={count <= 1} onClick={() => onMove(-1)} aria-label="Previous reference"><Icon name="previous" className="icon" /></button><button type="button" disabled={count <= 1} onClick={() => onMove(1)} aria-label="Next reference"><Icon name="next" className="icon" /></button></div></div></div>
    </div>
  </div>;
}
