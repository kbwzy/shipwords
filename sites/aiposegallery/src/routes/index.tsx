import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '~/site/icons';
import { PoseGeneratorPreview, type LibraryPose } from '~/site/pose-generator-preview';
import { LandingPlans } from '~/site/landing-plans';
import { MotionPreview } from '~/site/motion-preview';
import { poseCropStyle, type PoseCrop } from '~/site/pose-sheet';
import site from '../../site.config';

export const Route = createFileRoute('/')({
  head: () => pageHead(site, {
    title: 'AI Pose References for Artists | AI Pose Gallery',
    description: 'Explore AI-generated figure and yoga pose references for drawing and creative projects. Browse standing, seated, action and yoga studies.',
    path: '/',
    image: `${site.url}/yoga-reference-sheet.png`,
    jsonLd: [{ '@type': 'ImageGallery', name: site.name, url: site.url, description: 'A collection of AI-generated figure and yoga pose references for artists.' }],
  }),
  component: GalleryPage,
});

type Category = 'Standing' | 'Balancing' | 'Floor poses' | 'Seated' | 'Action' | 'Fashion' | 'Upper body';
type Pose = { id: string; name: string; category: Category; detail: string; prompt: string; tile: number; sheet?: 'figure' | 'fashion' | 'seated-extra' | 'movement-extra' | 'fashion-extra' | 'upper-extra' | 'expressive-extra' };
type Series = 'All series' | 'Full body · Standard' | 'Full body · Sensual / fashion' | 'Upper body · Solo';

type Sheet = { source: string; columns: number; sourceWidth: number; sourceHeight: number; rows?: readonly (readonly [number, number])[]; cols?: readonly (readonly [number, number])[] };
const extraCols = [[0, 414], [420, 834], [840, 1254]] as const;
const sheets: Record<NonNullable<Pose['sheet']> | 'yoga', Sheet> = {
  yoga: { source: '/yoga-reference-sheet.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254 },
  figure: { source: '/pose-reference-sheet.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254 },
  fashion: { source: '/fashion-reference-sheet.png', columns: 2, sourceWidth: 1024, sourceHeight: 1536, cols: [[0, 509], [516, 1024]], rows: [[0, 702], [709, 1536]] },
  'seated-extra': { source: '/seated-extra.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254, cols: extraCols, rows: [[0, 412], [420, 819], [827, 1254]] },
  'movement-extra': { source: '/movement-extra.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254, cols: extraCols, rows: [[0, 393], [396, 792], [797, 1254]] },
  'fashion-extra': { source: '/fashion-extra.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254, cols: extraCols, rows: [[0, 394], [400, 792], [798, 1254]] },
  'upper-extra': { source: '/upper-extra.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254, cols: extraCols, rows: [[0, 411], [417, 829], [833, 1254]] },
  'expressive-extra': { source: '/expressive-extra.png', columns: 3, sourceWidth: 1254, sourceHeight: 1254, cols: extraCols, rows: [[0, 406], [412, 819], [824, 1254]] },
};

function cropFor(pose: Pose): PoseCrop {
  const sheet = sheets[pose.sheet ?? 'yoga'];
  const column = pose.tile % sheet.columns;
  const row = Math.floor(pose.tile / sheet.columns);
  const [x, xEnd] = sheet.cols?.[column] ?? [column * sheet.sourceWidth / sheet.columns, (column + 1) * sheet.sourceWidth / sheet.columns];
  const [y, yEnd] = sheet.rows?.[row] ?? [row * sheet.sourceHeight / sheet.columns, (row + 1) * sheet.sourceHeight / sheet.columns];
  return { source: sheet.source, sourceWidth: sheet.sourceWidth, sourceHeight: sheet.sourceHeight, x, y, width: xEnd - x, height: yEnd - y };
}
function seriesFor(pose: Pose): Series {
  if (pose.sheet === 'upper-extra') return 'Upper body · Solo';
  if (pose.sheet === 'fashion' || pose.sheet === 'fashion-extra' || pose.sheet === 'expressive-extra') return 'Full body · Sensual / fashion';
  return 'Full body · Standard';
}

const poses: Pose[] = [
  { id: 'look-over-shoulder', name: 'Look over shoulder', category: 'Fashion', detail: 'A confident standing pose with a turn.', prompt: 'Adult woman in a fashion pose looking over her shoulder, hand on hip, full body.', tile: 0, sheet: 'fashion' },
  { id: 'fashion-seated', name: 'Seated fashion pose', category: 'Fashion', detail: 'A poised seated pose with legs crossed.', prompt: 'Adult woman sitting on a stool with crossed legs, full body.', tile: 1, sheet: 'fashion' },
  { id: 'arm-raised', name: 'Arm raised', category: 'Fashion', detail: 'An expressive standing silhouette.', prompt: 'Adult woman standing with one arm raised and weight shifted, full body.', tile: 2, sheet: 'fashion' },
  { id: 'fashion-walk', name: 'Fashion walk', category: 'Fashion', detail: 'A walking pose in profile.', prompt: 'Adult woman walking in profile, full body.', tile: 3, sheet: 'fashion' },
  { id: 'mountain-pose', name: 'Mountain pose', category: 'Standing', detail: 'A grounded, neutral standing reference.', prompt: 'Adult woman in mountain pose, standing upright with feet together and arms at her sides, full body, front view.', tile: 0 },
  { id: 'tree-pose', name: 'Tree pose', category: 'Balancing', detail: 'A balanced silhouette with hands at the chest.', prompt: 'Adult woman in tree pose, standing on one leg with hands together at the chest, full body, front view.', tile: 1 },
  { id: 'warrior-two', name: 'Warrior II', category: 'Standing', detail: 'A wide stance with arms extended.', prompt: 'Adult woman in warrior II yoga pose, wide stance, front knee bent and both arms extended, full body, side view.', tile: 2 },
  { id: 'triangle-pose', name: 'Triangle pose', category: 'Standing', detail: 'A long diagonal through the body and arms.', prompt: 'Adult woman in triangle yoga pose, wide stance, torso angled sideways, one arm reaching upward, full body.', tile: 3 },
  { id: 'downward-dog', name: 'Downward-facing dog', category: 'Floor poses', detail: 'An inverted V shape for gesture studies.', prompt: 'Adult woman in downward-facing dog yoga pose, hands and feet on the floor, hips lifted, full body, side view.', tile: 4 },
  { id: 'seated-forward-fold', name: 'Seated forward fold', category: 'Floor poses', detail: 'A seated stretch with a compact silhouette.', prompt: 'Adult woman seated with legs extended, folding forward towards her feet, full body, side view.', tile: 5 },
  { id: 'bridge-pose', name: 'Bridge pose', category: 'Floor poses', detail: 'A reclining pose with the hips lifted.', prompt: 'Adult woman in bridge pose, lying on her back with knees bent, feet grounded and hips raised, full body, side view.', tile: 6 },
  { id: 'low-lunge', name: 'Low lunge', category: 'Floor poses', detail: 'A kneeling lunge with arms reaching up.', prompt: 'Adult woman in a low yoga lunge, rear knee grounded, front knee bent and arms raised, full body, side view.', tile: 7 },
  { id: 'dancer-pose', name: 'Dancer pose', category: 'Balancing', detail: 'A standing balance with an open silhouette.', prompt: 'Adult woman in dancer yoga pose, balancing on one leg and holding the other foot behind her, full body, side view.', tile: 8 },
  { id: 'neutral-stance', name: 'Neutral stance', category: 'Standing', detail: 'A relaxed front-facing figure study.', prompt: 'Full-body mannequin standing in a neutral stance, front view.', tile: 0, sheet: 'figure' },
  { id: 'weight-shift', name: 'Weight shift', category: 'Standing', detail: 'A relaxed stance with weight on one leg.', prompt: 'Full-body mannequin standing with weight shifted onto one leg, front view.', tile: 1, sheet: 'figure' },
  { id: 'walking', name: 'Walking', category: 'Action', detail: 'A walking gesture in three-quarter view.', prompt: 'Full-body mannequin walking, three-quarter view.', tile: 2, sheet: 'figure' },
  { id: 'seated-crossed', name: 'Seated on a stool', category: 'Seated', detail: 'A seated figure with crossed legs.', prompt: 'Full-body mannequin sitting on a stool with crossed legs, three-quarter view.', tile: 3, sheet: 'figure' },
  { id: 'leaning', name: 'Leaning against a wall', category: 'Standing', detail: 'A casual standing pose against a wall.', prompt: 'Full-body mannequin leaning against a wall, arms crossed and ankles crossed.', tile: 4, sheet: 'figure' },
  { id: 'crouching', name: 'Crouching', category: 'Floor poses', detail: 'A compact crouched gesture.', prompt: 'Full-body mannequin crouching with arms resting in front, three-quarter view.', tile: 5, sheet: 'figure' },
  { id: 'running', name: 'Running', category: 'Action', detail: 'A dynamic running gesture.', prompt: 'Full-body mannequin running, side view.', tile: 6, sheet: 'figure' },
  { id: 'overhead-stretch', name: 'Overhead stretch', category: 'Standing', detail: 'A standing stretch with arms raised.', prompt: 'Full-body mannequin standing with arms extended overhead, front view.', tile: 7, sheet: 'figure' },
  { id: 'side-lunge', name: 'Side lunge', category: 'Action', detail: 'A wide lateral lunge.', prompt: 'Full-body mannequin in a wide side lunge, front view.', tile: 8, sheet: 'figure' },
  { id: 'chair-upright', name: 'Sitting upright', category: 'Seated', detail: 'A relaxed, front-facing chair pose.', prompt: 'Adult woman sitting upright on a chair, hands on knees, full body, front view.', tile: 0, sheet: 'seated-extra' },
  { id: 'chair-lean-forward', name: 'Leaning forward', category: 'Seated', detail: 'A seated pose with elbows resting on the knees.', prompt: 'Adult woman sitting on a chair, leaning forward with elbows on knees, full body, front view.', tile: 1, sheet: 'seated-extra' },
  { id: 'stool-crossed-leg', name: 'Sideways on a stool', category: 'Seated', detail: 'A relaxed seated pose with crossed legs.', prompt: 'Adult woman sitting sideways on a stool with crossed legs, full body, three-quarter view.', tile: 2, sheet: 'seated-extra' },
  { id: 'floor-knees-bent', name: 'Seated with knees bent', category: 'Seated', detail: 'A casual floor pose with the head resting on one hand.', prompt: 'Adult woman sitting on the floor with knees bent and head resting on one hand, full body.', tile: 3, sheet: 'seated-extra' },
  { id: 'cross-legged-floor', name: 'Cross-legged on the floor', category: 'Seated', detail: 'A front-facing cross-legged pose.', prompt: 'Adult woman sitting cross-legged on the floor with hands at her feet, full body, front view.', tile: 4, sheet: 'seated-extra' },
  { id: 'kneeling-upright', name: 'Kneeling upright', category: 'Floor poses', detail: 'A balanced kneeling figure with hands on thighs.', prompt: 'Adult woman kneeling upright with hands on thighs, full body, front view.', tile: 5, sheet: 'seated-extra' },
  { id: 'side-recline', name: 'Side recline', category: 'Floor poses', detail: 'A side-lying pose supported by one elbow.', prompt: 'Adult woman lying on her side, head supported by one hand, full body.', tile: 6, sheet: 'seated-extra' },
  { id: 'reclined-knees-bent', name: 'Reclined with knees bent', category: 'Floor poses', detail: 'A figure lying on her back with knees raised.', prompt: 'Adult woman lying on her back with knees bent and feet on the floor, full body, side view.', tile: 7, sheet: 'seated-extra' },
  { id: 'one-knee-down', name: 'One knee down', category: 'Floor poses', detail: 'A kneeling lunge with hands resting on the legs.', prompt: 'Adult woman kneeling on one knee with hands resting on her legs, full body, front view.', tile: 8, sheet: 'seated-extra' },
  { id: 'raised-knee-balance', name: 'Raised knee balance', category: 'Balancing', detail: 'A standing balance with one knee lifted.', prompt: 'Adult woman balancing on one leg with the other knee raised, full body, three-quarter view.', tile: 0, sheet: 'movement-extra' },
  { id: 'airplane-balance', name: 'Airplane balance', category: 'Balancing', detail: 'A forward lean with arms extended and one leg raised.', prompt: 'Adult woman balancing on one leg, torso leaning forward and arms extended sideways, full body.', tile: 1, sheet: 'movement-extra' },
  { id: 'standing-leg-hold', name: 'Standing leg hold', category: 'Balancing', detail: 'A standing balance holding one foot behind.', prompt: 'Adult woman standing on one leg, holding the other foot behind her with one hand, full body.', tile: 2, sheet: 'movement-extra' },
  { id: 'walking-step', name: 'Walking step', category: 'Action', detail: 'A natural walking gesture in profile.', prompt: 'Adult woman walking in a natural stride, full body, side view.', tile: 3, sheet: 'movement-extra' },
  { id: 'running-stride', name: 'Running stride', category: 'Action', detail: 'A running pose with bent arms.', prompt: 'Adult woman running with bent arms, full body, three-quarter view.', tile: 4, sheet: 'movement-extra' },
  { id: 'reaching-forward', name: 'Reaching forward', category: 'Action', detail: 'A forward lean with both arms reaching out.', prompt: 'Adult woman leaning forward and reaching ahead with both arms, full body.', tile: 5, sheet: 'movement-extra' },
  { id: 'wide-hands-on-hips', name: 'Wide stance', category: 'Standing', detail: 'A wide stance with hands on hips.', prompt: 'Adult woman standing with feet wide apart and hands on hips, full body.', tile: 6, sheet: 'movement-extra' },
  { id: 'standing-arms-crossed', name: 'Arms crossed', category: 'Standing', detail: 'A relaxed stance with folded arms.', prompt: 'Adult woman standing with arms crossed and weight shifted, full body, front view.', tile: 7, sheet: 'movement-extra' },
  { id: 'standing-t-pose', name: 'Arms extended', category: 'Standing', detail: 'A front-facing T-shaped figure.', prompt: 'Adult woman standing with both arms extended sideways, full body, front view.', tile: 8, sheet: 'movement-extra' },
  { id: 'fashion-hands-in-pockets', name: 'Hands in pockets', category: 'Fashion', detail: 'A relaxed standing fashion pose.', prompt: 'Adult woman standing with hands in pockets, full body, front view.', tile: 0, sheet: 'fashion-extra' },
  { id: 'fashion-chair-lean', name: 'Relaxed chair pose', category: 'Fashion', detail: 'A seated fashion pose with one hand at the face.', prompt: 'Adult woman sitting on a chair, leaning forward with one hand at her face, full body.', tile: 1, sheet: 'fashion-extra' },
  { id: 'fashion-hand-on-hip', name: 'Hand on hip', category: 'Fashion', detail: 'A standing fashion pose with a shifted weight.', prompt: 'Adult woman standing with one hand on her hip and weight shifted, full body.', tile: 2, sheet: 'fashion-extra' },
  { id: 'fashion-turn-back', name: 'Turned away', category: 'Fashion', detail: 'A casual turn with a glance over the shoulder.', prompt: 'Adult woman turning away and looking over her shoulder, full body.', tile: 3, sheet: 'fashion-extra' },
  { id: 'fashion-folded-arms', name: 'Folded arms', category: 'Fashion', detail: 'A straight standing pose with arms crossed.', prompt: 'Adult woman standing with arms folded, full body, front view.', tile: 4, sheet: 'fashion-extra' },
  { id: 'fashion-walking-look-back', name: 'Walking look back', category: 'Fashion', detail: 'A walking fashion pose with a glance back.', prompt: 'Adult woman walking and glancing back, carrying a handbag, full body.', tile: 5, sheet: 'fashion-extra' },
  { id: 'fashion-casual-stance', name: 'Casual stance', category: 'Fashion', detail: 'A relaxed stance with both hands in pockets.', prompt: 'Adult woman standing casually with both hands in pockets, full body.', tile: 6, sheet: 'fashion-extra' },
  { id: 'fashion-crossed-ankles', name: 'Crossed ankles', category: 'Fashion', detail: 'A relaxed pose with ankles crossed.', prompt: 'Adult woman standing with ankles crossed and hands in pockets, full body.', tile: 7, sheet: 'fashion-extra' },
  { id: 'fashion-adjust-hair', name: 'Adjusting hair', category: 'Fashion', detail: 'A standing pose with one hand raised to the hair.', prompt: 'Adult woman standing with one hand adjusting her hair, full body.', tile: 8, sheet: 'fashion-extra' },
  ...[
    ['Chin on hand', 'facing forward with chin resting on one hand'],
    ['Over the shoulder', 'turning and looking over the shoulder'],
    ['Arm over head', 'posing with one arm raised over the head'],
    ['Side profile', 'looking to the side in profile'],
    ['Hand on cheek', 'resting one cheek on one hand'],
    ['Portrait with folded arms', 'facing forward with folded arms'],
    ['Looking to the side', 'turning her gaze to the side'],
    ['Hands clasped', 'looking down with hands clasped'],
    ['Forward portrait', 'leaning forward and looking at the camera'],
  ].map(([name, detail], tile): Pose => ({ id: `upper-${tile + 1}`, name: name!, category: 'Upper body', detail: `Upper-body portrait, ${detail}.`, prompt: `Adult woman, upper-body portrait, ${detail}.`, tile, sheet: 'upper-extra' })),
  ...[
    ['Hand to hair', 'standing with one hand raised to her hair'],
    ['Turned fashion pose', 'standing turned away and looking over her shoulder'],
    ['Seated on a block', 'sitting with crossed legs and one hand at her chin'],
    ['Relaxed tailored look', 'standing with one hand in a pocket'],
    ['Dress with hand on hip', 'standing with one hand on her hip and legs crossed'],
    ['Turning in a dress', 'turning in a flowing dress with one hand near her shoulder'],
    ['Crossed-leg fashion pose', 'standing with legs crossed and hands in pockets'],
    ['Leaning on a stool', 'sitting on a stool and leaning forward'],
    ['Looking aside', 'standing with hands in pockets and looking to the side'],
  ].map(([name, detail], tile): Pose => ({ id: `expressive-${tile + 1}`, name: name!, category: 'Fashion', detail: `Fashion reference, ${detail}.`, prompt: `Adult woman ${detail}, full body, fashion photography.`, tile, sheet: 'expressive-extra' })),
];
const categories = ['All poses', 'Fashion', 'Standing', 'Seated', 'Action', 'Balancing', 'Floor poses', 'Upper body'] as const;
const seriesList: Series[] = ['All series', 'Full body · Standard', 'Full body · Sensual / fashion', 'Upper body · Solo'];
type Filter = typeof categories[number];

function Sprite({ pose, className = '' }: { pose: Pose; className?: string }) {
  return <div className={`pose-sprite ${className}`} role="img" aria-label={`AI-generated pose reference: ${pose.name}`} style={poseCropStyle(cropFor(pose))} />;
}

function GalleryPage() {
  const [filter, setFilter] = useState<Filter>('All poses');
  const [series, setSeries] = useState<Series>('All series');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Pose | null>(null);
  const [choice, setChoice] = useState<LibraryPose | null>(null);
  const search = query.trim().toLowerCase();
  const visible = poses.filter((pose) => (series === 'All series' || seriesFor(pose) === series) && (filter === 'All poses' || pose.category === filter) &&
    [pose.name, pose.category, pose.detail, pose.prompt].some((value) => value.toLowerCase().includes(search)));
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
          <h1>Find the pose.<br /><em>Bring ideas to life.</em></h1>
          <p>{import.meta.env.VITE_POSE_TRIAL_ENABLED === 'true' ? 'Explore pose references and generate a new pose from your photo with AI. The gallery stays free, and every visitor gets 3 free image generations each UTC day.' : "Explore figure, movement and yoga references for drawing, character studies and creative inspiration. Start with the free collection and preview what's coming next."}</p>
          <div className="hero-actions"><a className="button button-dark" href="#create">Explore the studio <Icon name="arrow" className="icon" /></a><a href="#pricing">View pricing</a></div>
          <div className="hero-note"><Icon name="mark" className="note-mark" /> For artists, storytellers & curious minds</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-card hero-card-back"><div className="hero-card-image"><Sprite pose={poses.find((pose) => pose.id === 'running')!} /></div><span>FIGURE STUDY</span></div>
          <div className="hero-card hero-card-front"><div className="hero-card-image"><Sprite pose={poses.find((pose) => pose.id === 'look-over-shoulder')!} /></div><span>POSE REFERENCE <b>01 / {poses.length}</b></span></div>
          <div className="hero-stamp">FIND YOUR<br /><strong>next pose.</strong><Icon name="arrow" className="icon" /></div>
        </div>
      </section>
      <PoseGeneratorPreview apiMode={import.meta.env.VITE_POSE_TRIAL_ENABLED === 'true' ? 'remote' : 'local'} choice={choice} library={poses.map((pose) => ({ id: pose.id, name: pose.name, prompt: pose.prompt, category: pose.category, series: seriesFor(pose), ...cropFor(pose) }))} onChoose={setChoice} />
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
        {visible.length ? <div className="pose-grid">{visible.map((pose) => <button type="button" className="pose-card" key={pose.id} onClick={() => setSelected(pose)} aria-label={`View ${pose.name}`}>
          <div className="pose-card-image"><Sprite pose={pose} /><span className="card-number">{String(poses.indexOf(pose) + 1).padStart(2, '0')}</span><span className="card-arrow"><Icon name="plus" className="icon" /></span></div>
          <div className="pose-card-caption"><div><strong>{pose.name}</strong><small>{pose.category}</small></div><Icon name="arrow" className="caption-arrow" /></div>
        </button>)}</div> : <div className="empty-state"><strong>No poses found.</strong><p>Try a different word or view the whole collection.</p><button type="button" onClick={() => { setQuery(''); setFilter('All poses'); setSeries('All series'); }}>Clear filters</button></div>}
      </section>
      <section id="how-it-works" className="how-section"><div className="how-heading"><div className="eyebrow"><span /> A SIMPLE CREATIVE RITUAL</div><h2>From reference<br />to <em>your own idea.</em></h2><p>Use these AI-generated studies to explore a silhouette, plan a composition or spark a character. Yoga studies are visual references, not instruction.</p></div><div className="steps"><div><span>01</span><h3>Find a pose</h3><p>Browse the collection or search for the gesture you have in mind.</p></div><div><span>02</span><h3>Take a closer look</h3><p>Open a study to see the details and a ready-to-use pose description.</p></div><div><span>03</span><h3>Make it yours</h3><p>Download the reference or copy the prompt into your own creative workflow.</p></div></div></section>
      <section className="closing"><Icon name="mark" className="closing-mark" /><p>EVERY IDEA STARTS SOMEWHERE</p><h2>Let's make something <em>move.</em></h2><a className="button button-dark" href="#gallery">Back to the gallery <Icon name="arrow" className="icon" /></a></section>
      {selected && <PoseDialog pose={selected} index={currentIndex} count={visible.length} onClose={() => setSelected(null)} onMove={move} onUse={() => { setChoice({ id: selected.id, name: selected.name, prompt: selected.prompt, category: selected.category, series: seriesFor(selected), ...cropFor(selected) }); setSelected(null); requestAnimationFrame(() => document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })); }} />}
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
      const { x, y, width, height } = cropFor(pose);
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
    image.src = cropFor(pose).source;
  }
  return <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={handleKey}>
    <div className="pose-dialog" role="dialog" aria-modal="true" aria-labelledby="pose-dialog-title">
      <button ref={closeButton} className="dialog-close" type="button" onClick={onClose} aria-label="Close pose details"><Icon name="close" className="icon" /></button>
      <div className="dialog-image"><Sprite pose={pose} /></div>
      <div className="dialog-content"><div className="eyebrow"><span /> POSE STUDY {String(poses.indexOf(pose) + 1).padStart(2, '0')}</div><h2 id="pose-dialog-title">{pose.name}</h2><p>{pose.detail}</p><span className="dialog-tag">{pose.category}</span><div className="prompt-block"><span>POSE PROMPT</span><p>{pose.prompt}</p></div><div className="dialog-actions"><button className="button button-dark" type="button" onClick={onUse}>Use this pose</button><button className="button button-outline" type="button" onClick={download}><Icon name="download" className="icon" /> Download PNG</button><button className="button button-outline" type="button" onClick={() => void copyPrompt()}><Icon name="copy" className="icon" /> Copy prompt</button></div><p className="dialog-status" aria-live="polite">{status || `AI-generated reference · ${cropFor(pose).width} × ${cropFor(pose).height} px`}</p><div className="dialog-navigation"><span>{index + 1} / {count}</span><div><button type="button" disabled={count <= 1} onClick={() => onMove(-1)} aria-label="Previous pose"><Icon name="previous" className="icon" /></button><button type="button" disabled={count <= 1} onClick={() => onMove(1)} aria-label="Next pose"><Icon name="next" className="icon" /></button></div></div></div>
    </div>
  </div>;
}
