import { describe, expect, it } from 'vitest';
import {
  POSE_CATEGORIES,
  POSE_CATEGORY_BY_SLUG,
  POSE_IMAGE_HEIGHT,
  POSE_IMAGE_WIDTH,
  POSES,
  POSE_VIEWS,
  poseCrop,
  poseViewAlt,
  poseViewImage,
  poseLibrary,
  poses,
  posesInCategory,
  seriesFor,
  type Pose,
  type PoseCategoryEntry,
  type PoseSeries,
} from '../src/site/pose-library';

const EXPECTED_IDS = [
  'look-over-shoulder',
  'fashion-seated',
  'arm-raised',
  'fashion-walk',
  'mountain-pose',
  'tree-pose',
  'warrior-two',
  'triangle-pose',
  'downward-dog',
  'seated-forward-fold',
  'bridge-pose',
  'low-lunge',
  'dancer-pose',
  'neutral-stance',
  'weight-shift',
  'walking',
  'seated-crossed',
  'leaning',
  'crouching',
  'running',
  'overhead-stretch',
  'side-lunge',
  'chair-upright',
  'chair-lean-forward',
  'stool-crossed-leg',
  'floor-knees-bent',
  'cross-legged-floor',
  'kneeling-upright',
  'side-recline',
  'reclined-knees-bent',
  'one-knee-down',
  'raised-knee-balance',
  'airplane-balance',
  'standing-leg-hold',
  'walking-step',
  'running-stride',
  'reaching-forward',
  'wide-hands-on-hips',
  'standing-arms-crossed',
  'standing-t-pose',
  'fashion-hands-in-pockets',
  'fashion-chair-lean',
  'fashion-hand-on-hip',
  'fashion-turn-back',
  'fashion-folded-arms',
  'fashion-walking-look-back',
  'fashion-casual-stance',
  'fashion-crossed-ankles',
  'fashion-adjust-hair',
  'upper-1',
  'upper-2',
  'upper-3',
  'upper-4',
  'upper-5',
  'upper-6',
  'upper-7',
  'upper-8',
  'upper-9',
  'expressive-1',
  'expressive-2',
  'expressive-3',
  'expressive-4',
  'expressive-5',
  'expressive-6',
  'expressive-7',
  'expressive-8',
  'expressive-9',
] as const;

const EXPECTED_CATEGORY_SLUGS = ['standing', 'seated', 'action', 'floor', 'balancing', 'upper-body', 'fashion'] as const;

/** Prompt exactly as it is hardcoded in src/routes/index.tsx today; the library must not drift from it. */
const EXPECTED_PROMPTS: Record<string, string> = {
  'look-over-shoulder': 'Adult woman in a fashion pose looking over her shoulder, hand on hip, full body.',
  'fashion-seated': 'Adult woman sitting on a stool with crossed legs, full body.',
  'arm-raised': 'Adult woman standing with one arm raised and weight shifted, full body.',
  'fashion-walk': 'Adult woman walking in profile, full body.',
  'mountain-pose': 'Adult woman in mountain pose, standing upright with feet together and arms at her sides, full body, front view.',
  'tree-pose': 'Adult woman in tree pose, standing on one leg with hands together at the chest, full body, front view.',
  'warrior-two': 'Adult woman in warrior II yoga pose, wide stance, front knee bent and both arms extended, full body, side view.',
  'triangle-pose': 'Adult woman in triangle yoga pose, wide stance, torso angled sideways, one arm reaching upward, full body.',
  'downward-dog': 'Adult woman in downward-facing dog yoga pose, hands and feet on the floor, hips lifted, full body, side view.',
  'seated-forward-fold': 'Adult woman seated with legs extended, folding forward towards her feet, full body, side view.',
  'bridge-pose': 'Adult woman in bridge pose, lying on her back with knees bent, feet grounded and hips raised, full body, side view.',
  'low-lunge': 'Adult woman in a low yoga lunge, rear knee grounded, front knee bent and arms raised, full body, side view.',
  'dancer-pose': 'Adult woman in dancer yoga pose, balancing on one leg and holding the other foot behind her, full body, side view.',
  'neutral-stance': 'Full-body mannequin standing in a neutral stance, front view.',
  'weight-shift': 'Full-body mannequin standing with weight shifted onto one leg, front view.',
  walking: 'Full-body mannequin walking, three-quarter view.',
  'seated-crossed': 'Full-body mannequin sitting on a stool with crossed legs, three-quarter view.',
  leaning: 'Full-body mannequin leaning against a wall, arms crossed and ankles crossed.',
  crouching: 'Full-body mannequin crouching with arms resting in front, three-quarter view.',
  running: 'Full-body mannequin running, side view.',
  'overhead-stretch': 'Full-body mannequin standing with arms extended overhead, front view.',
  'side-lunge': 'Full-body mannequin in a wide side lunge, front view.',
  'chair-upright': 'Adult woman sitting upright on a chair, hands on knees, full body, front view.',
  'chair-lean-forward': 'Adult woman sitting on a chair, leaning forward with elbows on knees, full body, front view.',
  'stool-crossed-leg': 'Adult woman sitting sideways on a stool with crossed legs, full body, three-quarter view.',
  'floor-knees-bent': 'Adult woman sitting on the floor with knees bent and head resting on one hand, full body.',
  'cross-legged-floor': 'Adult woman sitting cross-legged on the floor with hands at her feet, full body, front view.',
  'kneeling-upright': 'Adult woman kneeling upright with hands on thighs, full body, front view.',
  'side-recline': 'Adult woman lying on her side, head supported by one hand, full body.',
  'reclined-knees-bent': 'Adult woman lying on her back with knees bent and feet on the floor, full body, side view.',
  'one-knee-down': 'Adult woman kneeling on one knee with hands resting on her legs, full body, front view.',
  'raised-knee-balance': 'Adult woman balancing on one leg with the other knee raised, full body, three-quarter view.',
  'airplane-balance': 'Adult woman balancing on one leg, torso leaning forward and arms extended sideways, full body.',
  'standing-leg-hold': 'Adult woman standing on one leg, holding the other foot behind her with one hand, full body.',
  'walking-step': 'Adult woman walking in a natural stride, full body, side view.',
  'running-stride': 'Adult woman running with bent arms, full body, three-quarter view.',
  'reaching-forward': 'Adult woman leaning forward and reaching ahead with both arms, full body.',
  'wide-hands-on-hips': 'Adult woman standing with feet wide apart and hands on hips, full body.',
  'standing-arms-crossed': 'Adult woman standing with arms crossed and weight shifted, full body, front view.',
  'standing-t-pose': 'Adult woman standing with both arms extended sideways, full body, front view.',
  'fashion-hands-in-pockets': 'Adult woman standing with hands in pockets, full body, front view.',
  'fashion-chair-lean': 'Adult woman sitting on a chair, leaning forward with one hand at her face, full body.',
  'fashion-hand-on-hip': 'Adult woman standing with one hand on her hip and weight shifted, full body.',
  'fashion-turn-back': 'Adult woman turning away and looking over her shoulder, full body.',
  'fashion-folded-arms': 'Adult woman standing with arms folded, full body, front view.',
  'fashion-walking-look-back': 'Adult woman walking and glancing back, carrying a handbag, full body.',
  'fashion-casual-stance': 'Adult woman standing casually with both hands in pockets, full body.',
  'fashion-crossed-ankles': 'Adult woman standing with ankles crossed and hands in pockets, full body.',
  'fashion-adjust-hair': 'Adult woman standing with one hand adjusting her hair, full body.',
  'upper-1': 'Adult woman, upper-body portrait, facing forward with chin resting on one hand.',
  'upper-2': 'Adult woman, upper-body portrait, turning and looking over the shoulder.',
  'upper-3': 'Adult woman, upper-body portrait, posing with one arm raised over the head.',
  'upper-4': 'Adult woman, upper-body portrait, looking to the side in profile.',
  'upper-5': 'Adult woman, upper-body portrait, resting one cheek on one hand.',
  'upper-6': 'Adult woman, upper-body portrait, facing forward with folded arms.',
  'upper-7': 'Adult woman, upper-body portrait, turning her gaze to the side.',
  'upper-8': 'Adult woman, upper-body portrait, looking down with hands clasped.',
  'upper-9': 'Adult woman, upper-body portrait, leaning forward and looking at the camera.',
  'expressive-1': 'Adult woman standing with one hand raised to her hair, full body, fashion photography.',
  'expressive-2': 'Adult woman standing turned away and looking over her shoulder, full body, fashion photography.',
  'expressive-3': 'Adult woman sitting with crossed legs and one hand at her chin, full body, fashion photography.',
  'expressive-4': 'Adult woman standing with one hand in a pocket, full body, fashion photography.',
  'expressive-5': 'Adult woman standing with one hand on her hip and legs crossed, full body, fashion photography.',
  'expressive-6': 'Adult woman turning in a flowing dress with one hand near her shoulder, full body, fashion photography.',
  'expressive-7': 'Adult woman standing with legs crossed and hands in pockets, full body, fashion photography.',
  'expressive-8': 'Adult woman sitting on a stool and leaning forward, full body, fashion photography.',
  'expressive-9': 'Adult woman standing with hands in pockets and looking to the side, full body, fashion photography.',
};

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length;
const paragraphs = (pose: Pose): readonly string[] => pose.paragraphs;
const allParagraphs = POSES.flatMap((pose) => pose.paragraphs.map((text) => [pose.id, text] as const));

describe('pose library shape', () => {
  it('holds exactly the 67 gallery poses, in gallery order', () => {
    expect(POSES).toHaveLength(67);
    expect(POSES.map((pose) => pose.id)).toEqual([...EXPECTED_IDS]);
  });

  it('gives every pose a unique id and a URL-safe slug', () => {
    const ids = POSES.map((pose) => pose.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pose of POSES) expect(pose.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    const slugs = POSES.map((pose) => pose.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const pose of POSES) expect(pose.slug).toBe(pose.id);
  });

  it('keeps every generation prompt identical to the one already used on the site', () => {
    expect(Object.keys(EXPECTED_PROMPTS)).toHaveLength(67);
    for (const pose of POSES) expect(pose.prompt).toBe(EXPECTED_PROMPTS[pose.id]);
  });

  it('keeps the tile and sheet values from the reference sheets, and never reuses a tile inside one sheet', () => {
    const used = new Set<string>();
    for (const pose of POSES) {
      expect(pose.tile).toBeGreaterThanOrEqual(0);
      const slot = `${pose.sheet}#${pose.tile}`;
      expect(used.has(slot), `${slot} is claimed twice`).toBe(false);
      used.add(slot);
    }
  });
});

describe('categories', () => {
  it('exposes the seven category slugs with copy', () => {
    expect(POSE_CATEGORIES.map((entry) => entry.slug)).toEqual([...EXPECTED_CATEGORY_SLUGS]);
    expect(new Set(POSE_CATEGORIES.map((entry) => entry.category)).size).toBe(7);
    for (const entry of POSE_CATEGORIES) {
      expect(entry.title.length).toBeGreaterThan(10);
      expect(entry.shortDescription.length).toBeGreaterThan(40);
      expect(entry.intro.length).toBeGreaterThanOrEqual(2);
      expect(entry.intro.every((text) => words(text) >= 30)).toBe(true);
      expect(POSE_CATEGORY_BY_SLUG.get(entry.slug)).toBe(entry);
    }
  });

  it('files at least one pose under every category, and the counts add up to the library', () => {
    for (const entry of POSE_CATEGORIES) {
      const members = posesInCategory(entry.slug);
      expect(members.length, `category ${entry.slug} has no poses`).toBeGreaterThan(0);
      expect(members.every((pose) => pose.category === entry.category)).toBe(true);
    }
    const counts = POSE_CATEGORIES.reduce((total, entry) => total + posesInCategory(entry.slug).length, 0);
    expect(counts).toBe(POSES.length);
    for (const pose of POSES) expect(EXPECTED_CATEGORY_SLUGS.some((slug) => POSE_CATEGORY_BY_SLUG.get(slug)?.category === pose.category)).toBe(true);
  });

  it('writes unique category copy, not one paragraph with the label swapped', () => {
    const intros = POSE_CATEGORIES.flatMap((entry) => entry.intro);
    expect(new Set(intros).size).toBe(intros.length);
    const descriptions = POSE_CATEGORIES.map((entry) => entry.shortDescription);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

describe('per-pose copy', () => {
  it('gives every pose its own title, summary, alt text and at least three drawing tips', () => {
    for (const pose of POSES) {
      expect(pose.title.length).toBeGreaterThan(20);
      expect(words(pose.summary), `${pose.id} summary`).toBeGreaterThanOrEqual(8);
      expect(pose.alt.length).toBeGreaterThan(40);
      expect(pose.alt.toLowerCase()).toContain('generated');
      expect(pose.drawingTips).toHaveLength(3);
      for (const tip of pose.drawingTips) expect(words(tip)).toBeGreaterThanOrEqual(6);
    }
    const titles = POSES.map((pose) => pose.title);
    expect(new Set(titles).size).toBe(titles.length);
    const summaries = POSES.map((pose) => pose.summary);
    expect(new Set(summaries).size).toBe(summaries.length);
    const alts = POSES.map((pose) => pose.alt);
    expect(new Set(alts).size).toBe(alts.length);
  });

  it('writes a substantial description of two to three paragraphs for every pose', () => {
    for (const pose of POSES) {
      const total = words(paragraphs(pose).join(' '));
      expect(paragraphs(pose).length, `${pose.id} paragraphs`).toBeGreaterThanOrEqual(2);
      expect(paragraphs(pose).length, `${pose.id} paragraphs`).toBeLessThanOrEqual(3);
      expect(total, `${pose.id} description length`).toBeGreaterThanOrEqual(80);
      expect(total, `${pose.id} description length`).toBeLessThanOrEqual(260);
      for (const text of paragraphs(pose)) expect(words(text), `${pose.id} paragraph`).toBeGreaterThanOrEqual(25);
    }
  });

  it('never repeats a description paragraph or a whole description between poses', () => {
    expect(new Set(POSES.map((pose) => pose.paragraphs.join(' '))).size).toBe(POSES.length);
    expect(new Set(POSES.map((pose) => pose.summary)).size).toBe(POSES.length);
    const seen = new Map<string, string>();
    for (const [id, text] of allParagraphs) {
      const normalised = text.trim().toLowerCase();
      const previous = seen.get(normalised);
      expect(previous, `${id} reuses the paragraph of ${previous}`).toBeUndefined();
      seen.set(normalised, id);
    }
  });

  it('does not open two poses with the same sentence pattern', () => {
    const openings = POSES.map((pose) => pose.paragraphs[0]!.split(/[.!?]/)[0]!.trim().toLowerCase());
    expect(new Set(openings).size).toBe(openings.length);
    const firstTwo = POSES.map((pose) => pose.paragraphs[0]!.split(/\s+/).slice(0, 2).join(' ').toLowerCase());
    expect(new Set(firstTwo).size).toBe(firstTwo.length);
  });

  it('flattens the copy onto each record and never ships it twice under a nested key', () => {
    for (const pose of POSES) expect(Object.keys(pose)).not.toContain('copy');
    for (const pose of POSES as unknown as Record<string, unknown>[]) expect(pose.copy).toBeUndefined();
  });

  it('points every related pose at a different existing pose', () => {
    const ids = new Set(POSES.map((pose) => pose.id));
    for (const pose of POSES) {
      expect(pose.related.length).toBeGreaterThanOrEqual(3);
      expect(pose.related.length).toBeLessThanOrEqual(4);
      expect(new Set(pose.related).size).toBe(pose.related.length);
      for (const related of pose.related) {
        expect(related).not.toBe(pose.id);
        expect(ids.has(related), `${pose.id} links to unknown ${related}`).toBe(true);
      }
    }
  });

  it('keeps prompt notes, tags and copy free of stray markup or template slots', () => {
    for (const pose of POSES) {
      const copy = [pose.title, pose.summary, pose.alt, ...pose.paragraphs, ...pose.promptNotes, ...pose.drawingTips].join(' ');
      expect(copy).not.toMatch(/\{|\}|<[a-z/]|\bTBD\b|\bTODO\b|\bplaceholder\b/iu);
      expect(copy).not.toContain('  ');
      expect(pose.tags.length).toBeGreaterThanOrEqual(3);
      expect(pose.tags.every((tag) => tag === tag.toLowerCase())).toBe(true);
      expect(pose.promptNotes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('safety and scope of the copy', () => {
  it('never describes a nude, underwear-only or otherwise unsafe reference', () => {
    const banned = /\b(nude|naked|lingerie|underwear|undressed|topless|bikini|swimsuit|erotic|sensual pose|sexual)\b/i;
    for (const pose of POSES) {
      const copy = [pose.title, pose.summary, pose.alt, ...pose.paragraphs, ...pose.promptNotes, ...pose.drawingTips, ...pose.tags].join(' ');
      expect(copy, pose.id).not.toMatch(banned);
      expect(copy, pose.id).not.toMatch(/\b(minor|child|children|kid|teen|teenager|underage|girl|boy)\b/i);
    }
  });

  it('describes the figure as an adult and keeps every reference single-person', () => {
    for (const pose of POSES) {
      const copy = [pose.summary, pose.alt, ...pose.paragraphs, ...pose.drawingTips].join(' ');
      expect(copy.toLowerCase(), pose.id).not.toMatch(/\b(couple|partner|two people|both of them|cuddling|embracing each other)\b/);
    }
    const adultPoses = POSES.filter((pose) => /\badult\b/i.test(pose.prompt));
    expect(adultPoses.length).toBeGreaterThanOrEqual(58);
  });

  it('never claims a yoga-derived study is a posture instruction', () => {
    for (const pose of POSES) {
      const copy = [pose.title, pose.summary, ...pose.paragraphs, ...pose.promptNotes, ...pose.drawingTips].join(' ');
      expect(copy, pose.id).not.toMatch(/\b(how to (?:do|practice)|step-by-step|instructions? for (?:doing|practising)|benefits of (?:the pose|this pose))\b/i);
    }
    const yogaIds = POSES.filter((pose) => pose.sheet === 'yoga').map((pose) => pose.id);
    expect(yogaIds).toEqual(['mountain-pose', 'tree-pose', 'warrior-two', 'triangle-pose', 'downward-dog', 'seated-forward-fold', 'bridge-pose', 'low-lunge', 'dancer-pose']);
    for (const id of yogaIds) {
      const pose = poseLibrary.get(id)!;
      expect(pose.paragraphs.join(' ')).toMatch(/draw|silhouette|reference|study|foreshorten|sketch|outline|line/i);
    }
  });
});

describe('consumer contract', () => {
  const EXPECTED_SERIES: Record<PoseSeries, string[]> = {
    'Upper body · Solo': ['upper-extra'],
    'Full body · Sensual / fashion': ['fashion', 'fashion-extra', 'expressive-extra'],
    'Full body · Standard': ['yoga', 'figure', 'seated-extra', 'movement-extra'],
  };

  it('exports the resolved consumer array with the same 67 poses in the same order', () => {
    expect(poses).toHaveLength(67);
    expect(poses.map((pose) => pose.id)).toEqual([...EXPECTED_IDS]);
    expect(poses.map((pose) => pose.id)).toEqual(POSES.map((pose) => pose.id));
  });

  it('gives every pose its own image so no page needs a sheet table', () => {
    for (const entry of poses) {
      const pose = poseLibrary.get(entry.id)!;
      expect(entry).toMatchObject(poseCrop(pose.id));
      // Each pose is its own generated photograph, not a tile cut from a shared sprite sheet.
      expect(entry.source).toBe(`/poses/${entry.id}.webp`);
      expect(entry.sourceWidth).toBe(POSE_IMAGE_WIDTH);
      expect(entry.sourceHeight).toBe(POSE_IMAGE_HEIGHT);
      expect(entry.x).toBe(0);
      expect(entry.y).toBe(0);
      expect(entry.width).toBe(POSE_IMAGE_WIDTH);
      expect(entry.height).toBe(POSE_IMAGE_HEIGHT);
    }
    // Unique files: two poses must never share one image, or the pages become duplicates of each other.
    expect(new Set(poses.map((entry) => entry.source)).size).toBe(poses.length);
  });

  it('points every pose at a distinct webp file under /poses', () => {
    // Tests run in workerd, which has no real filesystem, so this checks the contract the build copies from rather than
    // stat-ing public/. The files themselves are verified by the build and by check-site.
    for (const entry of poses) {
      expect(entry.source, entry.id).toBe(`/poses/${entry.id}.webp`);
      expect(entry.source).toMatch(/^\/poses\/[a-z0-9-]+\.webp$/);
    }
  });

  it('gives every pose three distinct camera angles with distinct alt text', () => {
    // One hero shot plus a side and a rear study; the files are what the image sitemap advertises, so the ids must not collide.
    const files = new Set<string>();
    for (const pose of POSES) {
      for (const view of POSE_VIEWS) {
        const file = poseViewImage(pose.id, view);
        expect(file, `${pose.id} ${view}`).toMatch(/^\/poses\/[a-z0-9-]+\.webp$/);
        expect(files.has(file), `duplicate image file ${file}`).toBe(false);
        files.add(file);
      }
      // Alt text must differ per angle, or Google sees three copies of one caption.
      const alts = POSE_VIEWS.map((view) => poseViewAlt(pose, view));
      expect(new Set(alts).size, `${pose.id} alt text`).toBe(POSE_VIEWS.length);
      expect(poseViewAlt(pose, 'hero')).toBe(pose.alt);
      expect(poseViewAlt(pose, 'side')).not.toMatch(/front view|side view|rear view/i);
      expect(poseViewAlt(pose, 'back')).not.toMatch(/front view|side view|rear view/i);
    }
    expect(files.size).toBe(POSES.length * POSE_VIEWS.length);
  });

  it('assigns the same series the gallery filters use', () => {
    for (const [series, sheets] of Object.entries(EXPECTED_SERIES) as [PoseSeries, string[]][]) {
      for (const sheet of sheets) expect(seriesFor({ sheet: sheet as Pose['sheet'] })).toBe(series);
    }
    for (const entry of poses) {
      expect(entry.series).toBe(seriesFor(poseLibrary.get(entry.id)!));
      expect(['Full body · Standard', 'Full body · Sensual / fashion', 'Upper body · Solo']).toContain(entry.series);
    }
    expect(new Set(poses.map((pose) => pose.series))).toEqual(new Set(Object.keys(EXPECTED_SERIES)));
    expect(poses.filter((pose) => pose.series === 'Upper body · Solo')).toHaveLength(9);
  });

  it('keeps the full records reachable by id for the pose pages', () => {
    expect(poseLibrary.size).toBe(67);
    for (const id of EXPECTED_IDS) {
      const pose = poseLibrary.get(id);
      expect(pose, id).toBeDefined();
      expect(pose!.title.length).toBeGreaterThan(20);
      expect(pose!.paragraphs.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('category catalogue typing', () => {
  it('keeps category entries assignable to the exported type', () => {
    const entries: readonly PoseCategoryEntry[] = POSE_CATEGORIES;
    expect(entries.map((entry) => entry.category).sort()).toEqual(
      ['Action', 'Balancing', 'Fashion', 'Floor poses', 'Seated', 'Standing', 'Upper body'].sort(),
    );
  });
});
