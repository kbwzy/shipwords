// Pose library: the single source of truth for every study in the gallery. Each pose carries its crop on a reference sheet, the
// generation prompt used for it, and copy written from that pose's own mechanics (facing, weight, silhouette, drawing use and the
// mistake artists make with it). Copy describes clothed single-adult figure references for drawing and character work; the
// yoga-derived studies are visual references, not instruction.

import type { PoseCrop } from '~/site/pose-sheet';

export type PoseCategory = 'Standing' | 'Balancing' | 'Floor poses' | 'Seated' | 'Action' | 'Fashion' | 'Upper body';

export type PoseSeries = 'Full body · Standard' | 'Full body · Sensual / fashion' | 'Upper body · Solo';

/** A pose plus its resolved crop in the source sprite sheet, ready for poseCropStyle(). */
export type LibraryPose = PoseCrop & { id: string; name: string; prompt: string; category: string; series: PoseSeries };

export type PoseSheetName =
  | 'yoga'
  | 'figure'
  | 'fashion'
  | 'seated-extra'
  | 'movement-extra'
  | 'fashion-extra'
  | 'upper-extra'
  | 'expressive-extra';

export type PoseCopy = {
  title: string;
  summary: string;
  paragraphs: readonly string[];
  promptNotes: readonly string[];
  alt: string;
  tags: readonly string[];
  related: readonly string[];
  drawingTips: readonly string[];
};

/** Which camera angle a pose photograph was shot from. Every pose has a hero angle plus side and rear studies. */
export type PoseView = 'hero' | 'side' | 'back';

export const POSE_VIEWS: readonly PoseView[] = ['hero', 'side', 'back'];

/** The file id for one angle: the hero keeps the bare pose id, the others suffix `--side` / `--back`. */
export function poseViewFile(poseId: string, view: PoseView): string {
  return view === 'hero' ? poseId : `${poseId}--${view}`;
}

export function poseViewImage(poseId: string, view: PoseView): string {
  return `/poses/${poseViewFile(poseId, view)}.webp`;
}

export function poseViewImage2x(poseId: string, view: PoseView): string {
  return `/poses/2x/${poseViewFile(poseId, view)}.webp`;
}

/** View-specific alt text, so image search sees three distinct photographs rather than one repeated caption. */
export function poseViewAlt(pose: Pick<Pose, 'alt' | 'category'>, view: PoseView): string {
  if (view === 'hero') return pose.alt;
  const study = view === 'side' ? 'alternate study 1' : 'alternate study 2';
  return `AI-generated ${pose.category.toLowerCase()} pose reference, ${study}.`;
}

export type Pose = PoseCopy &
  PoseCrop & {
    slug: string;
    id: string;
    name: string;
    category: PoseCategory;
    tile: number;
    sheet: PoseSheetName;
    prompt: string;
  };

export type PoseCategoryEntry = {
  slug: 'standing' | 'seated' | 'action' | 'floor' | 'balancing' | 'upper-body' | 'fashion';
  category: PoseCategory;
  title: string;
  shortDescription: string;
  intro: readonly string[];
};

/**
 * Where a pose image lives: /poses/<id>.webp, generated as its own studio photograph. The return value keeps the PoseCrop
 * shape (source/sourceWidth/sourceHeight/x/y/width/height) so every consumer keeps reading the same fields, but the crop
 * is always the whole image.
 */
export const POSE_IMAGE_WIDTH = 960;
export const POSE_IMAGE_HEIGHT = 1280;

/** The generated file for one pose, with a 2x variant under /poses/2x/ for dense screens. */
export function poseImage(id: string): string {
  return `/poses/${id}.webp`;
}

export function poseImage2x(id: string): string {
  return `/poses/2x/${id}.webp`;
}

export function poseCrop(id: string): PoseCrop {
  return { source: poseImage(id), sourceWidth: POSE_IMAGE_WIDTH, sourceHeight: POSE_IMAGE_HEIGHT, x: 0, y: 0, width: POSE_IMAGE_WIDTH, height: POSE_IMAGE_HEIGHT };
}


type PoseSource = PoseCopy & {
  id: string;
  name: string;
  category: PoseCategory;
  tile: number;
  sheet: PoseSheetName;
  prompt: string;
};

/** The slug is the id: ids are already URL-safe and are what the gallery links and downloads use. */
function pose(source: PoseSource): Pose {
  return { ...source, slug: source.id, ...poseCrop(source.id) };
}

export const POSE_CATEGORIES: readonly PoseCategoryEntry[] = [
  {
    slug: 'standing',
    category: 'Standing',
    title: 'Standing Pose References for Drawing',
    shortDescription: 'Upright figures where the whole body is visible and the line of action runs from the floor to the head.',
    intro: [
      'A standing study looks simple and is not. Once a figure is upright, everything a viewer reads about temperament comes from small offsets: which hip is higher, where the ribcage sits over the pelvis, whether the head sits forward of the shoulders or above them, and how the feet are arranged on the ground.',
      'Use these references when you are building a character sheet, blocking a page composition, or testing how much attitude a silhouette can carry while the body stays still. Check the contact points first, then the tilt of the shoulders against the tilt of the hips, then the negative space between the arms and the torso.',
    ],
  },
  {
    slug: 'seated',
    category: 'Seated',
    title: 'Seated Pose References for Drawing',
    shortDescription: 'Figures on chairs, stools and the floor, where the pelvis takes weight and the torso has to fold around the seat.',
    intro: [
      'Seated poses put a hard constraint in the middle of the figure: whatever the sitter rests on decides the height of the pelvis, the angle of the thighs and how far the torso can lean before the balance looks wrong.',
      'These studies are useful for conversation scenes, interiors, portrait crops that need a lower eye line, and portfolio or magazine layouts where a seated silhouette fills a tall space differently from a standing one. Watch where the seat plane cuts the figure, and whether the clothing creases agree with the pressure points you have drawn.',
    ],
  },
  {
    slug: 'action',
    category: 'Action',
    title: 'Action Pose References for Drawing',
    shortDescription: 'Walking, running and lunging figures whose weight is mid-transfer between two feet.',
    intro: [
      'A pose caught mid-motion only reads correctly when the weight is moving somewhere. The shoulders and hips counter-rotate, one side of the body compresses while the other stretches, and the trailing limb finishes the gesture.',
      'These are good for gesture practice, storyboard beats and character sheets that need the figure from more than one angle. Draw the leading foot and the center of mass before the arms, or the pose will end up floating even when the limbs are individually correct.',
    ],
  },
  {
    slug: 'floor',
    category: 'Floor poses',
    title: 'Floor Pose References for Drawing',
    shortDescription: 'Reclining, kneeling and inverted shapes that leave the upright line and redistribute weight to the ground.',
    intro: [
      'Once a figure leaves its feet, the silhouette gets compressed and oblique, which is exactly why these references are hard to invent and useful to study. The hips, shoulder girdle and pelvis turn against each other, and the ground becomes the anchor every part of the drawing has to answer to.',
      'These studies suit foreshortening practice, low camera angles, costume and drapery tests where fabric piles or falls sideways, and any composition that needs a figure to sit low in the frame. Identify the support points first and the pose becomes legible.',
    ],
  },
  {
    slug: 'balancing',
    category: 'Balancing',
    title: 'Balance Pose References for Drawing',
    shortDescription: 'Single-leg support studies, useful when you want a figure to look suspended in its own effort.',
    intro: [
      'Balanced poses are built on one narrow contact point, and the rest of the body answers that constraint. The lifted limb, the arms and the tilt of the head all exist to keep the mass over the supporting foot, so the drawing has to show that struggle somewhere.',
      'Take these references when you want a character to feel controlled rather than casual, or when you are studying how tension travels up one leg and through a long vertical line. The common failure is symmetry: draw the supporting side compress and the lifted side lift, never the reverse.',
    ],
  },
  {
    slug: 'upper-body',
    category: 'Upper body',
    title: 'Upper Body Pose References for Drawing',
    shortDescription: 'Bust and half-length studies where the hands and head carry the expression.',
    intro: [
      'A cropped figure changes the job of the drawing. With the legs gone, the hands, neck and tilt of the head have to announce what the whole body is doing, so every small rotation of the ribcage reads louder than it would in a full figure.',
      'These studies are made for character portraits, book and editorial illustration, expression sheets and lighting tests on skin. Block the shoulder line and the two forearm angles before rendering anything, and keep the crop from cutting the wrists in a way that hides the gesture.',
    ],
  },
  {
    slug: 'fashion',
    category: 'Fashion',
    title: 'Fashion Pose References for Drawing',
    shortDescription: 'Editorial standing and seated studies with styled lines, clear attitude and deliberate angles.',
    intro: [
      'Fashion poses are a set of conventions for making a figure read at a glance: a deliberate inequality between the two sides of the body, long lines that follow the clothing, and a gaze that is rarely level at the camera.',
      'They are a good test bed for costume design, silhouette and attitude, because the pose is chosen to show off clothes. Draw the body underneath first and hang the fabric on it afterward; the poses fall apart when the figure is copied from what the outfit does rather than what the body is doing.',
    ],
  },
];

const POSES_SOURCE: readonly PoseSource[] = [
  {
    id: 'look-over-shoulder',
    name: 'Look over shoulder',
    category: 'Fashion',
    tile: 0,
    sheet: 'fashion',
    prompt: 'Adult woman in a fashion pose looking over her shoulder, hand on hip, full body.',
    title: 'Fashion Pose Reference: Look Over the Shoulder',
    summary: 'A three-quarter stance with the face turned past the shoulder, so the gaze and the chest point in different directions.',
    paragraphs: [
      'The body here is in a soft three-quarter turn while the head rotates further, past the shoulder line, so the viewer gets the chest and the face at the same time. Because the near arm is anchored on the hip, the elbow pushes out and creates a closed triangle between arm, waist and ribs; that triangle is what makes the pose read as confident rather than turned away.',
      'Conventionally the weight sits on the back leg, which lifts the front hip and gives the torso its slight rise. Look at the neck: the sternocleidomastoid tightens on the turning side and the shoulder on that side drops a little to free the range. That asymmetry is the whole point of the pose.',
      'For drawing, treat it as an attitude study and a costume line. The upward elbow gives you a strong diagonal to hang a sleeve, a jacket edge or a strap from. The usual mistake is rotating the whole figure with the head, which flattens the turn into a flat frontal view; keep the hips where they are and let the head be the only thing that goes past the vertical.',
    ],
    promptNotes: [
      'A three-quarter stance with the face turned past the shoulder, so the gaze and the chest point in different directions.',
      'If the generated result loses the turn and reads fully frontal, add a phrase like slight rotation in the chest to push the shoulders away from the camera.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman in a three-quarter stance looking over her shoulder with one hand on her hip, full body.',
    tags: ['fashion', 'over-the-shoulder', 'three-quarter view', 'attitude'],
    related: ['fashion-turn-back', 'expressive-2', 'upper-2', 'fashion-hand-on-hip'],
    drawingTips: [
      'Draw the shoulder line first: the turning side drops while the head keeps rotating past it.',
      'Use the raised elbow as the top point of a triangle of negative space against the waist.',
      'Keep the hips square to the three-quarter angle so the head turn stays readable.',
    ],
  },
  {
    id: 'fashion-seated',
    name: 'Seated fashion pose',
    category: 'Fashion',
    tile: 1,
    sheet: 'fashion',
    prompt: 'Adult woman sitting on a stool with crossed legs, full body.',
    title: 'Fashion Pose Reference: Seated on a Stool with Crossed Legs',
    summary: 'A seated editorial pose where crossed legs shorten the silhouette and throw the torso onto one hip.',
    paragraphs: [
      'Sitting on a stool means there is no back to lean on, so the spine holds itself upright and the crossed legs do the work of the pose. The top thigh lies across the lower one, which raises the whole leg line by a few centimetres and pushes that hip up; the torso compensates by drifting toward the other side.',
      'From a sitting height the figure is a compact block with two long diagonals: the crossing thigh moving across the frame and the torso leaning against it. That contrast is why the pose photographs well for clothes with volume through the hip and knee.',
      'In a drawing, watch the seat plane and the crossing point. Both legs share one silhouette edge at the knee, and artists often draw them as two parallel tubes, which kills the depth cue. Also check the hanging foot: it should drop straight, not follow the angle of the crossed leg. For costume work this is a useful study of how a skirt or wide trouser leg folds when one knee rests on the other.',
    ],
    promptNotes: [
      'A seated editorial pose where crossed legs shorten the silhouette and throw the torso onto one hip.',
      'Stool height matters for how the legs hang; name a height in your own variation when the pose needs a specific proportion.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman seated on a stool with crossed legs, full body.',
    tags: ['fashion', 'seated', 'stool', 'crossed legs'],
    related: ['stool-crossed-leg', 'expressive-8', 'fashion-chair-lean', 'chair-upright'],
    drawingTips: [
      'Draw the seat plane as a flat line before drawing the thighs, so both legs hang from the same height.',
      'Give the crossed thigh a clean overlap edge at the knee instead of two parallel tubes.',
      'Let the hanging foot drop vertically; only the thigh carries the diagonal.',
    ],
  },
  {
    id: 'arm-raised',
    name: 'Arm raised',
    category: 'Fashion',
    tile: 2,
    sheet: 'fashion',
    prompt: 'Adult woman standing with one arm raised and weight shifted, full body.',
    title: 'Fashion Pose Reference: Standing with One Arm Raised',
    summary: 'A standing pose with one arm lifted overhead, opening the ribcage and lengthening one side of the torso.',
    paragraphs: [
      'The lifted arm pulls the ribcage up on that side, which lengthens the waist and shortens the neck on the raised side. Because the other arm stays low, the figure has two different side shapes, and the eye follows the long line from the raised hand down through the opposite hip to the supporting foot.',
      'Weight is shifted off the raised shoulder, so the pelvis tips the other way and one hip juts. This keeps the pose from looking like a straight vertical bar with a flag on it. The whole silhouette reads as a leaning rectangle with one corner extended, which is why it works for long coats, tunics and anything cut to fall in an unbroken line.',
      'When you draw it, plot the raised arm as two segments that do not align perfectly: the upper arm swings out a little, the forearm continues upward with a slight bend. The most common error is a perfectly straight arm glued to the head, which removes the shoulder joint entirely. Check too that the armpit has a deep fold and the opposite side of the torso is stretched smooth; those two cues sell the lift.',
    ],
    promptNotes: [
      'A standing pose with one arm lifted overhead, opening the ribcage and lengthening one side of the torso.',
      'Ask for the lifted elbow to stay clear of the head if the arm keeps merging with the hairline.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with one arm raised overhead and her weight shifted onto one leg, full body.',
    tags: ['fashion', 'arm raised', 'standing', 'asymmetry'],
    related: ['overhead-stretch', 'expressive-1', 'upper-3', 'standing-t-pose'],
    drawingTips: [
      'Draw the lifted arm with a soft bend at the elbow instead of a rigid line against the head.',
      'Mark the armpit fold on the raised side; the opposite flank stays stretched.',
      'Tilt the pelvis away from the raised shoulder so the figure keeps its counterweight.',
    ],
  },
  {
    id: 'fashion-walk',
    name: 'Fashion walk',
    category: 'Fashion',
    tile: 3,
    sheet: 'fashion',
    prompt: 'Adult woman walking in profile, full body.',
    title: 'Fashion Pose Reference: Walking in Profile',
    summary: 'A true side view of a walking figure, with the stride line and the body counter-lean reading as one arc.',
    paragraphs: [
      'In profile the stride is decided by where the hips sit between the two feet, and in a catwalk walk they pass under the body rather than ahead of it. The torso leans back very slightly against the forward leg, the chest stays open and the head holds level, all of which turn a plain walk into a controlled presentation of the clothes.',
      'The silhouette is the strongest thing to study here: a near-vertical body over two legs that intersect, with the trailing foot either just leaving the floor or about to touch. Front and back edges of the figure are close together, so every change of thickness, from ribcage to waist to hip, becomes visible.',
      'For artists the profile view is unforgiving about proportion. Check that the forward knee sits ahead of the ribs and that the down arm crosses in front of the body rather than hanging outside it. A frequent mistake is drawing the trailing leg as a straight extension of the spine; the back thigh actually leaves the pelvis at a distinctly different angle.',
    ],
    promptNotes: [
      'A true side view of a walking figure, with the stride line and the body counter-lean reading as one arc.',
      'If the arms swing too far, add arms relaxed at the sides to keep the editorial stillness.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman walking in profile, full body, editorial presentation.',
    tags: ['fashion', 'walking', 'profile', 'stride'],
    related: ['walking-step', 'fashion-walking-look-back', 'walking', 'expressive-4'],
    drawingTips: [
      'Stack the ear, shoulder, hip and ankle near a single vertical before adding the stride offset.',
      'Draw the back thigh leaving the pelvis at its own angle instead of extending the spine.',
      'Keep the head level while the torso counter-leans over the support leg.',
    ],
  },
  {
    id: 'mountain-pose',
    name: 'Mountain pose',
    category: 'Standing',
    tile: 0,
    sheet: 'yoga',
    prompt: 'Adult woman in mountain pose, standing upright with feet together and arms at her sides, full body, front view.',
    title: 'Standing Pose Reference: Upright Neutral Stance',
    summary: 'A symmetrical, front-facing standing study with the feet together and the arms hanging quietly at the sides.',
    paragraphs: [
      'This is the flattest, most symmetrical pose in the library, which is exactly what makes it a good baseline. The figure faces the camera squarely, the feet touch along the inner edge, the arms hang beside the hips and only the hands break the outline slightly. Load is split evenly between both legs, so both hips sit at the same height.',
      'What the silhouette gives you is pure vertical structure: a column with visible widths at shoulders, ribs, waist and hip. It reads as stillness and self-containment, so it suits a character introduction, a costume front view, or a reference plate where you want to compare proportions without any foreshortening.',
      'The drawing risk is that symmetry turns into stiffness. In a real standing body the arms are not parallel to the torso; there is a gap that widens at the elbow and narrows at the wrist, and the shoulders are never completely level. Give one shoulder a few degrees of drop, keep the collarbones slightly curved, and taper the forearms so the hands read as weight rather than decoration. This is also a good study for the notch where the neck meets the shoulders, since nothing hides it.',
    ],
    promptNotes: [
      'A symmetrical, front-facing standing study with the feet together and the arms hanging quietly at the sides.',
      'This study is a visual reference for proportions, not a posture instruction.',
    ],
    alt: 'AI-generated standing pose reference: adult woman standing upright facing the camera with feet together and arms at her sides, full body.',
    tags: ['standing', 'front view', 'symmetrical', 'neutral'],
    related: ['neutral-stance', 'standing-t-pose', 'weight-shift', 'chair-upright'],
    drawingTips: [
      'Leave a widening gap between arm and torso from shoulder to wrist; parallel arms read as stiff.',
      'Curve the collarbones slightly and shorten one shoulder by a few degrees.',
      'Draw the neck-to-shoulder notch first, since nothing in this pose conceals it.',
    ],
  },
  {
    id: 'tree-pose',
    name: 'Tree pose',
    category: 'Balancing',
    tile: 1,
    sheet: 'yoga',
    prompt: 'Adult woman in tree pose, standing on one leg with hands together at the chest, full body, front view.',
    title: 'Balance Pose Reference: Single-Leg Standing with Hands at the Chest',
    summary: 'A front-facing balance with one foot against the standing leg and the palms joined in front of the sternum.',
    paragraphs: [
      'One leg carries everything and the other folds out to the side, the sole resting against the inner standing leg. That lateral fold is what makes the pose asymmetric from the front: the pelvis tilts up on the lifted side, the standing hip juts out, and the raised knee points away from the body rather than forward.',
      'The joined hands in front of the chest pull both shoulders forward and down, closing the ribcage. Together with the lift of one leg, that creates a narrow vertical with a wide horizontal band at the elbows, and the outline reads as calm and contained even though the body is doing work.',
      'Draw the standing leg as a compressed column: the knee stays soft rather than locked, and the calf muscles tighten. The lifted thigh rotates out from the hip socket, which means the kneecap turns outward and the inner thigh faces the camera. Beginners drawing this pose usually put the lifted foot too high and let it float; check that the sole presses into the leg and the ankle is flexed. The upward drift of one hip and the slight lean of the torso toward the standing side complete the balance.',
    ],
    promptNotes: [
      'A front-facing balance with one foot against the standing leg and the palms joined in front of the sternum.',
      'This study is a visual reference for the silhouette, not a posture instruction.',
    ],
    alt: 'AI-generated balance pose reference: adult woman standing on one leg with the other foot against her standing leg and hands joined at the chest, front view.',
    tags: ['balancing', 'front view', 'single leg', 'hands at chest'],
    related: ['raised-knee-balance', 'standing-leg-hold', 'dancer-pose', 'mountain-pose'],
    drawingTips: [
      'Turn the lifted kneecap outward so the inner thigh faces the camera.',
      'Keep the standing knee soft and compress the calf; a locked leg reads as a prop.',
      'Press the lifted sole into the standing leg so the foot stops floating.',
    ],
  },
  {
    id: 'warrior-two',
    name: 'Warrior II',
    category: 'Standing',
    tile: 2,
    sheet: 'yoga',
    prompt: 'Adult woman in warrior II yoga pose, wide stance, front knee bent and both arms extended, full body, side view.',
    title: 'Standing Pose Reference: Wide Stance with Extended Arms',
    summary: 'A wide lunge with both arms stretched horizontally, one arm forward and one back, giving a long cross-body line.',
    paragraphs: [
      'Both arms stretch out along one horizontal axis, so the shoulders and the ground form a cross. The front knee is bent over its ankle and the back leg stays long, which puts more weight over the front foot and turns the hips open to the side. The chest faces one direction and the head can turn to face the other.',
      'That split between shoulder axis and hip axis is the useful part of the study. From the side the figure reads as a broad, stable triangle resting on a wide base, with a single horizontal bar through the shoulders. It is a strong shape for a wide page, for a group composition that needs one figure to hold the horizontal rhythm, and for costume work on garments that open at the chest and swing at the hem.',
      'The recurring drawing error is flattening the pelvis. If you draw both hips level and square to the camera, the bent knee no longer belongs to the body and the stance collapses into a fencer\u2019s lunge facing forward. Mark the two hip points on different depth planes first, draw the bent thigh as a tube that angles forward and out, and check the back heel: in this study it stays planted, which forces the back thigh to rotate and shortens the visible line.',
    ],
    promptNotes: [
      'A wide lunge with both arms stretched horizontally, one arm forward and one back, giving a long cross-body line.',
      'This study is a visual reference for the shape, not a posture instruction.',
    ],
    alt: 'AI-generated standing pose reference: adult woman in a wide stance with a bent front knee and both arms extended sideways, head turned to the side.',
    tags: ['standing', 'wide stance', 'arms extended', 'head turned'],
    related: ['triangle-pose', 'side-lunge', 'wide-hands-on-hips', 'standing-t-pose'],
    drawingTips: [
      'Place the two hip points on different depth planes before drawing the thighs.',
      'Keep the back heel planted; that is what shortens the back leg line.',
      'Run the arms along one horizontal axis and let the head turn separately.',
    ],
  },
  {
    id: 'triangle-pose',
    name: 'Triangle pose',
    category: 'Standing',
    tile: 3,
    sheet: 'yoga',
    prompt: 'Adult woman in triangle yoga pose, wide stance, torso angled sideways, one arm reaching upward, full body.',
    title: 'Standing Pose Reference: Side Lean with One Arm Reaching Up',
    summary: 'A wide stance with the torso folded to one side, one arm reaching up and the other pointing down.',
    paragraphs: [
      'A wide base supports a torso that hinges sideways over the front leg, so the body forms two long edges that converge at the pelvis. One arm continues the line of the leaning torso upward and the other points straight down, which gives the figure a single unbroken diagonal from fingertip to fingertip.',
      'Weight collects over the front leg and hip, and the back hip turns under, which flattens the seat and lengthens the back of the body. The head follows the top arm, so the face is turned toward the ceiling rather than the viewer. The result is a lightweight, open silhouette that fills a tall format well and stays readable at thumbnail size.',
      'What artists get wrong is the fold itself. The spine does not bend sideways like a bow; the pelvis stays relatively level and the torso rotates and hinges at the hip joint, so the ribcage shifts sideways rather than compressing. Draw the hip crease on the folded side, keep both legs long and straight, and check that the top arm is a true continuation of the spine rather than sticking out at an angle. The arch of the lower back in the drawing usually means the pelvis was rotated incorrectly.',
    ],
    promptNotes: [
      'A wide stance with the torso folded to one side, one arm reaching up and the other pointing down.',
      'This study is a visual reference for the line of action, not a posture instruction.',
    ],
    alt: 'AI-generated standing pose reference: adult woman in a wide stance with her torso angled to the side and one arm reaching upward, full body.',
    tags: ['standing', 'wide stance', 'side bend', 'long line'],
    related: ['warrior-two', 'side-lunge', 'overhead-stretch', 'dancer-pose'],
    drawingTips: [
      'Hinge at the hip rather than bowing the spine, so the ribcage shifts sideways.',
      'Run the top arm as a continuation of the spine, not at a separate angle.',
      'Mark the hip crease on the folded side to prove the torso has rotated.',
    ],
  },
  {
    id: 'downward-dog',
    name: 'Downward-facing dog',
    category: 'Floor poses',
    tile: 4,
    sheet: 'yoga',
    prompt: 'Adult woman in downward-facing dog yoga pose, hands and feet on the floor, hips lifted, full body, side view.',
    title: 'Floor Pose Reference: Inverted V with Hips Lifted',
    summary: 'An inverted V with hands and feet on the ground, hips at the apex and the spine forming a long diagonal.',
    paragraphs: [
      'Two contact points on two different levels of the frame, hands forward and feet back, turn the figure into a tent: arms drop from the shoulders, legs angle up from the ankles, and everything meets at the highest point of the hips. Weight is carried partly forward into the hands and partly back into the feet, with the torso hanging between them.',
      'In side view the shape is startlingly simple, two sides of a triangle with a flat ground line, and that is precisely why it is a useful gesture study. There is no head above the shoulders, no upright line, and no familiar silhouette to copy from memory, so you are forced to read the actual proportions of arm and leg length against torso length.',
      'The mistake to guard against is the straight-line tent. In an adult figure the arms are short enough that the shoulders sit well above the hands but not above the feet, and the back must keep the curve of the ribcage rather than becoming a rigid plank. Draw the armpit fold where the arm meets the torso, note how the heels lift or settle, and watch the angle of the head: it hangs between the upper arms, not straight down from the neck.',
    ],
    promptNotes: [
      'An inverted V with hands and feet on the ground, hips at the apex and the spine forming a long diagonal.',
      'This study is a visual reference for the shape, not a posture instruction.',
    ],
    alt: 'AI-generated floor pose reference: adult woman with hands and feet on the floor and hips lifted into an inverted V, full body, side view.',
    tags: ['floor', 'inverted', 'side view', 'gesture study'],
    related: ['bridge-pose', 'crouching', 'side-recline', 'reclined-knees-bent'],
    drawingTips: [
      'Keep the ribcage curve rather than drawing the back as a straight plank.',
      'Draw the head hanging between the upper arms instead of dropping from the neck.',
      'Decide whether the heels are lifted or settled before you finish the ground line.',
    ],
  },
  {
    id: 'seated-forward-fold',
    name: 'Seated forward fold',
    category: 'Floor poses',
    tile: 5,
    sheet: 'yoga',
    prompt: 'Adult woman seated with legs extended, folding forward towards her feet, full body, side view.',
    title: 'Floor Pose Reference: Seated Fold with Legs Extended',
    summary: 'A seated figure with both legs stretched forward and the torso folded down over them.',
    paragraphs: [
      'Sitting with both legs straight ahead puts the pelvis directly on the ground and turns the whole figure into a narrow horizontal block. Folding the torso forward stacks the ribs over the thighs, so the body becomes one dense shape with a rounded back on top and long straight legs below.',
      'This is a compact, low silhouette, and it holds a good lesson about how little of the figure survives when it folds. The shoulders move forward of the hips, the arms reach along the legs, and the head drops toward the shins. That makes it a strong study for compression: you can see where the abdomen shortens, where the back of the torso lengthens, and where the fabric of a shirt or dress bunches at the waist.',
      'Draw the hip crease first, because that is the hinge; artists often fold at the waist and leave the pelvis upright, giving a sitting figure that looks like a bent pipe. Keep the legs close together with the knees slightly soft, taper the calves and let the feet relax rather than point rigidly. The neck matters too: the head should hang between the arms with the back of the neck long, not crane up to look at the feet.',
    ],
    promptNotes: [
      'A seated figure with both legs stretched forward and the torso folded down over them.',
      'This study is a visual reference for the compressed silhouette, not a posture instruction.',
    ],
    alt: 'AI-generated floor pose reference: adult woman seated with legs extended and folding forward over her legs, full body, side view.',
    tags: ['floor', 'seated', 'folded', 'compression'],
    related: ['cross-legged-floor', 'reclined-knees-bent', 'floor-knees-bent', 'kneeling-upright'],
    drawingTips: [
      'Hinge at the hip crease so the pelvis tips with the fold.',
      'Show the back lengthening and the abdomen shortening as one movement.',
      'Let the head hang between the arms with a long back of the neck.',
    ],
  },
  {
    id: 'bridge-pose',
    name: 'Bridge pose',
    category: 'Floor poses',
    tile: 6,
    sheet: 'yoga',
    prompt: 'Adult woman in bridge pose, lying on her back with knees bent, feet grounded and hips raised, full body, side view.',
    title: 'Floor Pose Reference: Reclining Figure with Hips Raised',
    summary: 'A back-lying figure with knees bent and hips lifted, forming an arch with two clear contact points.',
    paragraphs: [
      'The shoulders and head stay on the floor while the hips rise, so the body forms a low arch with the knees at the top of the bent legs and the feet planted under them. Weight is shared between the upper back and the soles, with the arms lying along the ground for support.',
      'In profile the pose is a set of clear angles: a horizontal line along the shoulder girdle, a diagonal up through the thighs, and vertical shins dropping to the feet. That makes it unusually good for studying how the ribcage and pelvis relate when they are not stacked, and it is a natural fit for drapery, since any garment falls backward along the torso toward the shoulders.',
      'The error most drawings show is a bend in the wrong place. The arch comes from the hips extending, not from folding the knees further, so the thigh line should be a straight run from knee to hip with only the pelvis rotating. Check the neck: the head must stay flat and long, and the chin should not be crushed against the chest. Also watch the feet, which in this study stay parallel and planted rather than turning out.',
    ],
    promptNotes: [
      'A back-lying figure with knees bent and hips lifted, forming an arch with two clear contact points.',
      'This study is a visual reference for the arch shape, not a posture instruction.',
    ],
    alt: 'AI-generated floor pose reference: adult woman lying on her back with knees bent, feet on the floor and hips raised, full body, side view.',
    tags: ['floor', 'reclining', 'arch', 'side view'],
    related: ['reclined-knees-bent', 'low-lunge', 'side-recline', 'downward-dog'],
    drawingTips: [
      'Arch through the hips, keeping the thigh line straight from knee to hip.',
      'Keep the head flat with a long neck instead of tucking the chin into the chest.',
      'Plant the feet parallel so the shins drop vertically.',
    ],
  },
  {
    id: 'low-lunge',
    name: 'Low lunge',
    category: 'Floor poses',
    tile: 7,
    sheet: 'yoga',
    prompt: 'Adult woman in a low yoga lunge, rear knee grounded, front knee bent and arms raised, full body, side view.',
    title: 'Floor Pose Reference: Kneeling Lunge with Arms Raised',
    summary: 'A long kneeling lunge, one knee on the floor and one foot forward, with both arms lifted overhead.',
    paragraphs: [
      'One shin lies along the ground and the other leg steps forward into a right angle, so the base is long and diagonal rather than wide. The hips sit low and forward, the chest opens, and both arms rise above the head, extending the body into a single tall column rising out of an angled base.',
      'That contrast between a grounded rear leg and a lifted torso is what the pose offers: you get both a strong ground plane and a long vertical in one silhouette. It suits tall compositions, character sheets that need to show leg angle clearly, and costume work on garments that gather at the knee and fall over the hip.',
      'Watch the rear leg in a drawing. The knee is on the floor, which means the shin torques slightly and the foot turns with it, so the arch of the foot often faces upward. Artists frequently draw that lower leg as if it were standing up, leaving the knee hovering. On the front side, keep the thigh horizontal rather than sloping down, place the shin vertical under the knee, and make sure the raised arms leave the shoulder line rather than sprouting from the neck.',
    ],
    promptNotes: [
      'A long kneeling lunge, one knee on the floor and one foot forward, with both arms lifted overhead.',
      'This study is a visual reference for the long base, not a posture instruction.',
    ],
    alt: 'AI-generated floor pose reference: adult woman in a kneeling lunge with one knee on the floor, the front knee bent and both arms raised, full body, side view.',
    tags: ['floor', 'lunge', 'kneeling', 'arms raised'],
    related: ['one-knee-down', 'kneeling-upright', 'bridge-pose', 'dancer-pose'],
    drawingTips: [
      'Lay the rear shin flat and let the foot turn with it instead of hovering.',
      'Keep the front thigh horizontal and the shin vertical under the knee.',
      'Start the raised arms at the shoulder line, not at the neck.',
    ],
  },
  {
    id: 'dancer-pose',
    name: 'Dancer pose',
    category: 'Balancing',
    tile: 8,
    sheet: 'yoga',
    prompt: 'Adult woman in dancer yoga pose, balancing on one leg and holding the other foot behind her, full body, side view.',
    title: 'Balance Pose Reference: Single-Leg Hold with the Back Foot Caught',
    summary: 'A forward-leaning balance on one leg, with the other foot held behind and the free arm stretched ahead.',
    paragraphs: [
      'Everything hinges on the supporting foot. The torso tips forward, the back leg folds up behind the body, and one hand catches that foot, which pulls the raised leg into a curve. The other arm reaches forward, so the figure spans a wide arc from the fingertips of the front hand around to the bent knee behind.',
      'The pose reads as forward motion held still, and it is the most dynamic of the single-leg studies because the body is off its vertical axis. Use it for gesture work, for characters in performative or theatrical situations, and as a test of how a long garment swings when the hips are tilted and one leg is lifted.',
      'The trap when drawing it is collapsing the support leg. It should be a straight, slightly compressed column under a pelvis that has rotated, not a slouch. Give the raised knee a clear bend and check that the hand grips the ankle or the top of the foot rather than the middle of the leg. The torso curve matters too: the chest stays open and the spine extends forward, so the back does not round even though the figure leans.',
    ],
    promptNotes: [
      'A forward-leaning balance on one leg, with the other foot held behind and the free arm stretched ahead.',
      'This study is a visual reference for the arc of the body, not a posture instruction.',
    ],
    alt: 'AI-generated balance pose reference: adult woman balancing on one leg with the other foot held behind her and one arm reaching forward, full body, side view.',
    tags: ['balancing', 'single leg', 'arc', 'side view'],
    related: ['standing-leg-hold', 'tree-pose', 'airplane-balance', 'low-lunge'],
    drawingTips: [
      'Keep the support leg straight and compressed under a rotated pelvis.',
      'Grip the ankle or top of the foot, not the middle of the shin.',
      'Keep the chest open so the forward lean does not round the back.',
    ],
  },
  {
    id: 'neutral-stance',
    name: 'Neutral stance',
    category: 'Standing',
    tile: 0,
    sheet: 'figure',
    prompt: 'Full-body mannequin standing in a neutral stance, front view.',
    title: 'Standing Pose Reference: Neutral Front Stance',
    summary: 'A plain front-facing figure study with the feet slightly apart and no gesture in the arms.',
    paragraphs: [
      'A mannequin figure in front view removes the distractions of texture and clothing and leaves the structural questions exposed. The feet are set a little apart, toes pointing forward, so the base is a short horizontal. The arms hang without tension, and because nothing crosses the body, the outline is a clean series of widths.',
      'Treat this as the measuring plate for everything else in the library. It shows where the shoulder width sits relative to the hips, how much of the forearm falls below the waist, and how the ankles taper into the feet. When a more dramatic pose looks wrong, this is the view you compare it against.',
      'The main thing to get right is the tilt of the pelvis over two even legs. Level hips do not mean a flat line: they mean equal compression in both knees and a slight natural curve at the waist. Draw through the landmarks, the pit of the neck, the two hip points and the ankles, before you outline anything, and keep the feet the same length in perspective rather than drawing the far foot narrower out of habit.',
    ],
    promptNotes: [
      'A plain front-facing figure study with the feet slightly apart and no gesture in the arms.',
      'A mannequin base like this pairs well with later variations that add weight or gesture on top.',
    ],
    alt: 'AI-generated standing pose reference: neutral full-body figure facing the camera in a plain stance, front view.',
    tags: ['standing', 'front view', 'mannequin', 'proportions'],
    related: ['mountain-pose', 'weight-shift', 'standing-t-pose', 'walking'],
    drawingTips: [
      'Draw landmarks first: neck pit, both hip points and both ankles.',
      'Match both feet for length; the far foot is not automatically narrower.',
      'Keep both knees equally soft instead of locking one to level the hips.',
    ],
  },
  {
    id: 'weight-shift',
    name: 'Weight shift',
    category: 'Standing',
    tile: 1,
    sheet: 'figure',
    prompt: 'Full-body mannequin standing with weight shifted onto one leg, front view.',
    title: 'Standing Pose Reference: Weight Shifted onto One Leg',
    summary: 'A front-view stance where one leg carries the body and the hip counter-rises, breaking the symmetry.',
    paragraphs: [
      'Shift the load onto one leg and the body instantly stops being symmetrical. The supporting side compresses, that hip lifts, and the pelvis tilts; the free leg relaxes, usually with the knee slightly bent and the foot turned out. Upward from there the torso leans back toward the carrying side to bring the head over the foot.',
      'This is the smallest possible amount of attitude, so it is worth studying closely. The figure is still standing, still readable, and yet the whole character of the pose has changed from neutral to idle. That makes it the right reference for any character standing around in a scene: waiting, listening, thinking, about to move.',
      'Artists routinely flatten this pose by keeping the hips level and only bending one knee. The hip has to rise on the loaded side, or the torso cannot counter-lean and the figure reads as a mannequin with a broken leg. Draw a single curve from the supporting foot up through the lifted hip to the opposite shoulder, and let the head sit slightly off center above that curve rather than in the exact middle of the shoulders.',
    ],
    promptNotes: [
      'A front-view stance where one leg carries the body and the hip counter-rises, breaking the symmetry.',
      'The asymmetry here is small on purpose; exaggerate it only if the silhouette needs to read at small sizes.',
    ],
    alt: 'AI-generated standing pose reference: full-body figure facing the camera with weight shifted onto one leg, hip tilted, front view.',
    tags: ['standing', 'weight shift', 'contrapposto', 'front view'],
    related: ['neutral-stance', 'standing-arms-crossed', 'fashion-hand-on-hip', 'arm-raised'],
    drawingTips: [
      'Lift the hip on the loaded side and lean the torso back toward it.',
      'Draw one curve from the support foot through the raised hip to the opposite shoulder.',
      'Place the head slightly off the midpoint of the shoulder line.',
    ],
  },
  {
    id: 'walking',
    name: 'Walking',
    category: 'Action',
    tile: 2,
    sheet: 'figure',
    prompt: 'Full-body mannequin walking, three-quarter view.',
    title: 'Action Pose Reference: Walking, Three-Quarter View',
    summary: 'A mid-stride figure seen from three-quarter front, with one leg advancing and the opposite arm swinging.',
    paragraphs: [
      'Three-quarter front is the most common angle in illustration and the least forgiving for a walk, because both the rotation of the torso and the depth of the stride have to be believable at once. The near leg advances toward the camera and the far leg trails back, so the two legs are seen at different foreshortening lengths even though they are the same length in reality.',
      'The torso counter-rotates against the hips: the forward leg brings its hip forward while the same-side shoulder drops back. That opposition is what gives the walk its rhythm, and it reads clearly in this angle because you can see both the chest plane and the hip plane turning in opposite directions.',
      'What goes wrong most often is even leg length. Draw both legs at the same length on the page and the far one will look too long, so shorten the trailing leg and hide part of it behind the near thigh. Watch the hips as well: in a walk the pelvis is never level, it rises over the supporting leg and drops on the swinging side. Keep the head steady and the neck long so the figure does not appear to lurch.',
    ],
    promptNotes: [
      'A mid-stride figure seen from three-quarter front, with one leg advancing and the opposite arm swinging.',
      'Mannequin wording keeps the study about structure; add clothing only when you want to test silhouette.',
    ],
    alt: 'AI-generated action pose reference: full-body figure walking, seen from three-quarter front with one leg advancing.',
    tags: ['action', 'walking', 'three-quarter view', 'stride'],
    related: ['walking-step', 'fashion-walk', 'neutral-stance', 'running'],
    drawingTips: [
      'Shorten the trailing leg on the page to keep it the same length as the near one.',
      'Rotate shoulders and hips in opposite directions through the stride.',
      'Keep the head level so the walk does not read as a lurch.',
    ],
  },
  {
    id: 'seated-crossed',
    name: 'Seated on a stool',
    category: 'Seated',
    tile: 3,
    sheet: 'figure',
    prompt: 'Full-body mannequin sitting on a stool with crossed legs, three-quarter view.',
    title: 'Seated Pose Reference: Stool Seat with Crossed Legs, Three-Quarter View',
    summary: 'A torso-and-legs study on a stool, seen from three-quarter front with one leg crossed over the other.',
    paragraphs: [
      'With no chair back, the torso on a stool is a free-standing mass balanced on the pelvis. The crossing leg adds a second layer: the near thigh lifts and turns across the body, so from three-quarter front you see the top surface of the thigh, the knee pointing toward the camera, and the hanging shin dropping behind it.',
      'The pose is a good exercise in overlap. Two legs, one seat edge and two arms give you four or five separate planes to sort into near and far, which is exactly the skill that fails in quick figure work. It also reads well as a neutral seated attitude for scene illustration, an interview setting, or a shop interior.',
      'Check the seat height against the shin. If the stool is tall, the hanging foot does not reach the floor and the line of the calf lengthens noticeably. If it is short, the thighs angle up and the torso has to lean forward slightly for balance. Draw the seat as a parallelogram in perspective rather than a rectangle, and put the weight clearly over one hip so the figure does not look suspended.',
    ],
    promptNotes: [
      'A torso-and-legs study on a stool, seen from three-quarter front with one leg crossed over the other.',
      'The stool is not drawn in the reference, so imagine its plane when you build the drawing.',
    ],
    alt: 'AI-generated seated pose reference: full-body figure sitting on a stool with crossed legs, three-quarter view.',
    tags: ['seated', 'stool', 'crossed legs', 'three-quarter view'],
    related: ['fashion-seated', 'stool-crossed-leg', 'chair-upright', 'expressive-8'],
    drawingTips: [
      'Draw the seat edge as a parallelogram in perspective before the thighs.',
      'Sort the crossing thigh in front of the hanging shin with one clear overlap edge.',
      'Check the hanging foot against the floor line to confirm stool height.',
    ],
  },
  {
    id: 'leaning',
    name: 'Leaning against a wall',
    category: 'Standing',
    tile: 4,
    sheet: 'figure',
    prompt: 'Full-body mannequin leaning against a wall, arms crossed and ankles crossed.',
    title: 'Standing Pose Reference: Figure Leaning on a Wall',
    summary: 'A relaxed standing figure with crossed arms and crossed ankles, resting part of its weight against a vertical surface.',
    paragraphs: [
      'A lean changes the direction of the support. Instead of standing on the feet alone, the figure transfers some load backward onto a wall through the shoulders and upper back, while the feet stay in front. Crossed ankles shorten the base and take even more work away from the legs, which is why the pose reads as relaxed waiting.',
      'Seen from the front the outline is wide at the shoulders and narrow at the feet, with the body angling slightly back from the ankles. The crossed arms add a horizontal band across the chest and drop the shoulders, closing the upper silhouette. Together these make a compact, self-contained shape that works well on a poster edge, beside text, or in a doorway scene.',
      'Draw the vertical of the wall first, then the point where the back meets it. The most frequent mistake is a figure that leans but keeps its weight centered over the ankles, which looks like it is falling; the ankle line has to be clearly forward of the shoulder contact. Keep the crossing of the ankles legible, with the front foot in front of the back ankle and both feet flat on the ground, and remember that crossed arms fold one forearm over the other, not edge to edge.',
    ],
    promptNotes: [
      'A relaxed standing figure with crossed arms and crossed ankles, resting part of its weight against a vertical surface.',
      'Useful when a composition needs a figure that belongs to an architectural edge.',
    ],
    alt: 'AI-generated standing pose reference: full-body figure leaning against a wall with crossed arms and crossed ankles.',
    tags: ['standing', 'leaning', 'crossed arms', 'relaxed'],
    related: ['standing-arms-crossed', 'fashion-folded-arms', 'fashion-crossed-ankles', 'weight-shift'],
    drawingTips: [
      'Set the ankle line clearly forward of the shoulder contact with the wall.',
      'Fold one forearm over the other so the crossed arms show a clear overlap.',
      'Keep the feet flat even though the ankles cross.',
    ],
  },
  {
    id: 'crouching',
    name: 'Crouching',
    category: 'Floor poses',
    tile: 5,
    sheet: 'figure',
    prompt: 'Full-body mannequin crouching with arms resting in front, three-quarter view.',
    title: 'Floor Pose Reference: Deep Crouch, Three-Quarter View',
    summary: 'A compact crouched figure with knees folded fully and the arms brought in front of the torso.',
    paragraphs: [
      'A crouch compresses the figure more than any other supported pose. The knees fold past ninety degrees, the hips drop until they are close to the heels, and the torso pitches forward to keep the mass over the feet. The arms come forward, sometimes resting near the knees, which closes the front of the silhouette.',
      'Studying it teaches you how little depth survives when a body folds. The ribcage and pelvis crowd together, the belly is compressed, and the head sits low, roughly level with the shoulders. That tightness makes it a useful reference for tense or furtive characters, for a figure fitting into a low space, and for close-quarter composition where a standing body would not fit.',
      'The drawing mistake is a crouch built from a standing figure with shortened shins. The thigh must run nearly horizontal from knee to hip, the calf must fold back under it, and the pelvis has to sit behind the knees with the heels lifted or flat. Watch the ankle: a deep crouch usually lifts the heels, and hiding that will flatten the pose. Also check the arms, which should hang from the shoulders rather than start at the waist.',
    ],
    promptNotes: [
      'A compact crouched figure with knees folded fully and the arms brought in front of the torso.',
      'If the knees read shallow, describe them as folded deeply so the hips drop below the knees.',
    ],
    alt: 'AI-generated floor pose reference: full-body figure crouching with arms resting in front, three-quarter view.',
    tags: ['floor', 'crouch', 'compressed', 'three-quarter view'],
    related: ['downward-dog', 'kneeling-upright', 'floor-knees-bent', 'one-knee-down'],
    drawingTips: [
      'Run the thigh nearly horizontal and fold the calf back beneath it.',
      'Sit the pelvis behind the knees rather than stacking it over them.',
      'Decide whether the heels lift, and draw that lift honestly.',
    ],
  },
  {
    id: 'running',
    name: 'Running',
    category: 'Action',
    tile: 6,
    sheet: 'figure',
    prompt: 'Full-body mannequin running, side view.',
    title: 'Action Pose Reference: Running, Side View',
    summary: 'A side-view running figure in full stride, legs opposed and the torso pitched forward over the lead foot.',
    paragraphs: [
      'Side view is the clearest way to see a run, because the stride length is fully visible and one leg cannot hide behind the other. The lead leg reaches forward, the trailing leg kicks back and up, and the torso leans forward from the ankles so the chest stays over the support foot. There is a moment in every stride when both feet are off the ground, and drawing that lift is what makes the pose read as speed rather than as walking quickly.',
      'The silhouette is long and low, and the diagonal from the trailing heel up through the hips to the head is the line of action. Everything in a run answers to that diagonal: the angle of the arms, the tilt of the head, the forward sweep of the shoulders.',
      'The classic error is an upright torso. A runner whose spine is vertical looks like a person jogging in place. Also check the hips, which stay under the shoulders rather than dropping behind them, and make sure the trailing leg has a clear bend at the knee, with the heel coming toward the seat rather than trailing in a long straight line. Feet in a run land under the body, so the lead foot should not be thrown far ahead of the knee.',
    ],
    promptNotes: [
      'A side-view running figure in full stride, legs opposed and the torso pitched forward over the lead foot.',
      'Speed comes from the airborne moment; ask for a flight phase if the result looks like a fast walk.',
    ],
    alt: 'AI-generated action pose reference: full-body figure running in side view with legs opposed and torso pitched forward.',
    tags: ['action', 'running', 'side view', 'line of action'],
    related: ['running-stride', 'walking', 'fashion-walk', 'reaching-forward'],
    drawingTips: [
      'Pitch the torso forward from the ankles so the chest sits over the support foot.',
      'Bend the trailing knee and bring the heel toward the seat.',
      'Land the lead foot under the knee, not far ahead of it.',
    ],
  },
  {
    id: 'overhead-stretch',
    name: 'Overhead stretch',
    category: 'Standing',
    tile: 7,
    sheet: 'figure',
    prompt: 'Full-body mannequin standing with arms extended overhead, front view.',
    title: 'Standing Pose Reference: Standing with Arms Extended Overhead',
    summary: 'A front-facing figure with both arms reaching straight above the head, stretching the torso into a narrow column.',
    paragraphs: [
      'Travelling overhead along the body axis, both arms do three things at once: it lifts the ribcage out of the pelvis, narrows the waist, and elongates the gap between the hips and the hands. The figure becomes a tall column with one modest widening at the shoulders and a smaller one at the hips.',
      'Because the pose rises out of the frame, it is excellent for tall page formats and for character sheets that need to show the full reach of the arms. It is also a clean anatomy study for the shoulder girdle, since raising both arms rotates the scapulae and opens the armpits where most garments fold outward.',
      'Draw the arms as two long segments with a slight angle change at the elbow, and keep the hands roughly above the shoulders rather than converging over the head unless the study shows them touching. A common mistake is letting the arms form a perfect narrow V with the elbows locked, which makes the figure look like a drawing of a triangle rather than a person. Watch the neck, which disappears slightly when the shoulders rise; leave enough length between the jaw and the collarbone for the head to still read.',
    ],
    promptNotes: [
      'A front-facing figure with both arms reaching straight above the head, stretching the torso into a narrow column.',
      'Great for showing arm length; the crop needs to include the hands to keep the proportion believable.',
    ],
    alt: 'AI-generated standing pose reference: full-body figure standing facing the camera with both arms extended overhead, front view.',
    tags: ['standing', 'overhead', 'front view', 'stretch'],
    related: ['arm-raised', 'standing-t-pose', 'mountain-pose', 'triangle-pose'],
    drawingTips: [
      'Bend the elbows very slightly instead of drawing locked straight arms.',
      'Keep the hands near the shoulder line rather than over the crown.',
      'Leave visible neck between the jaw and collarbone when the shoulders rise.',
    ],
  },
  {
    id: 'side-lunge',
    name: 'Side lunge',
    category: 'Action',
    tile: 8,
    sheet: 'figure',
    prompt: 'Full-body mannequin in a wide side lunge, front view.',
    title: 'Action Pose Reference: Wide Lateral Lunge, Front View',
    summary: 'A front-view lunge with one leg bent and the other extended, giving a wide, low, ground-hugging shape.',
    paragraphs: [
      'From the front, a side lunge is a wide base with an uneven top. One leg bends at the knee and takes the load, the other stays straight and reaches out, and the pelvis sinks toward the bent side. The torso stays over the loaded leg so the body does not tip, and the arms either rest on the bent knee or stay open for balance.',
      'The shape is unusually wide for its height, which makes it useful when a composition needs a low horizontal anchor, and it shows the difference between an extended knee and a bent one more clearly than any other front-view pose. The inner line of the straight leg and the outer line of the bent leg make two contrasting curves across the figure.',
      'Beginners draw a lunge like a split: both legs long, the body floating between them. The bent side must actually lower, with the knee travelling out over the foot and the hip dropping below the straight leg hip. Check the straight leg too, since it should turn the foot out and stay rigid rather than sagging at the ankle. The head stays roughly centered over the loaded hip, and the spine stays upright, not folded sideways toward the reach.',
    ],
    promptNotes: [
      'A front-view lunge with one leg bent and the other extended, giving a wide, low, ground-hugging shape.',
      'If the pose reads like a split, add that one knee is deeply bent and the hips sink toward that side.',
    ],
    alt: 'AI-generated action pose reference: full-body figure in a wide lateral lunge, front view, one knee bent and the other leg extended.',
    tags: ['action', 'lunge', 'wide base', 'front view'],
    related: ['warrior-two', 'triangle-pose', 'crouching', 'wide-hands-on-hips'],
    drawingTips: [
      'Drop the pelvis toward the bent knee so the two hips sit at different heights.',
      'Turn the foot of the straight leg outward and keep its knee locked.',
      'Keep the spine upright instead of folding it toward the extended leg.',
    ],
  },
  {
    id: 'chair-upright',
    name: 'Sitting upright',
    category: 'Seated',
    tile: 0,
    sheet: 'seated-extra',
    prompt: 'Adult woman sitting upright on a chair, hands on knees, full body, front view.',
    title: 'Seated Pose Reference: Upright on a Chair, Hands on Knees',
    summary: 'A square seated figure on a chair, hands resting on the knees and both feet flat.',
    paragraphs: [
      'Think of this as the reference point for all seated poses. The pelvis sits at the back of the seat, both feet are flat on the floor with the knees bent to roughly a right angle, and the hands rest on the knees. The torso is vertical and the shoulders are level, so the front view is remarkably simple.',
      'Simplicity is the value here: it isolates how a seated body stacks. You can study the way the thighs project toward the camera and foreshorten, how the torso sits on the hip bones, and where the hands land when the arms hang relaxed. It works as a neutral character pose for dialogue scenes, for interiors and for a portrait crop at seated height.',
      'The frequent error is drawing a standing figure with a folded bottom half. Watch the knees: because the thighs come toward the viewer, the knees overlap the shins and everything below the knee is hidden except the feet. Also make sure the chair seat is not wider than the hips in perspective and that the hands hold the knees from above rather than hovering in front of them. Then check the feet, which should be flat and pointing forward, not splayed.',
    ],
    promptNotes: [
      'A square seated figure on a chair, hands resting on the knees and both feet flat.',
      'Chair front views are useful baselines; change only one variable at a time when you draw variations.',
    ],
    alt: 'AI-generated seated pose reference: adult woman sitting upright on a chair with her hands on her knees, front view, full body.',
    tags: ['seated', 'chair', 'front view', 'hands on knees'],
    related: ['mountain-pose', 'chair-lean-forward', 'neutral-stance', 'fashion-chair-lean'],
    drawingTips: [
      'Let the knees overlap the shins so the thigh foreshortening reads correctly.',
      'Rest the hands on top of the knees, not in the air in front of them.',
      'Keep both feet flat and pointing forward.',
    ],
  },
  {
    id: 'chair-lean-forward',
    name: 'Leaning forward',
    category: 'Seated',
    tile: 1,
    sheet: 'seated-extra',
    prompt: 'Adult woman sitting on a chair, leaning forward with elbows on knees, full body, front view.',
    title: 'Seated Pose Reference: Forward Lean with Elbows on Knees',
    summary: 'A seated figure pitched forward off the chair back, elbows planted on the knees and the chest brought low.',
    paragraphs: [
      'Lean a seated figure forward and the whole mass travels over the feet and knees. The elbows land on the knees and take part of the upper body weight, the chest drops, and the spine rounds slightly. Head, chest and hands end up stacked over the feet in a compact triangle.',
      'That triangle is the reason this pose reads as attention: listening, thinking, waiting for an answer, about to stand up. It is a strong pose for an interview scene or a conversation beat because the forward lean directs all the figure\'s energy toward the opposite side of the frame.',
      'When drawing, look at the line from the hip to the shoulder; it is clearly forward of vertical, and the back foot may even be behind the knee to keep the torso from tipping. The mistake is bending at the waist while leaving the pelvis upright, which produces a slouch that lacks the forward commitment. Keep the forearms roughly parallel and vertical from elbow to hand, and check that the knees stay over the feet rather than straightening as the weight shifts forward.',
    ],
    promptNotes: [
      'A seated figure pitched forward off the chair back, elbows planted on the knees and the chest brought low.',
      'Matches an attentive, conversational beat rather than a relaxed one.',
    ],
    alt: 'AI-generated seated pose reference: adult woman sitting on a chair and leaning forward with her elbows on her knees, front view.',
    tags: ['seated', 'chair', 'forward lean', 'attention'],
    related: ['chair-upright', 'fashion-chair-lean', 'seated-forward-fold', 'expressive-8'],
    drawingTips: [
      'Tilt the whole torso forward from the hips instead of only rounding the upper back.',
      'Plant the forearms nearly vertical from elbow to hand.',
      'Keep the knees over the feet as the weight moves forward.',
    ],
  },
  {
    id: 'stool-crossed-leg',
    name: 'Sideways on a stool',
    category: 'Seated',
    tile: 2,
    sheet: 'seated-extra',
    prompt: 'Adult woman sitting sideways on a stool with crossed legs, full body, three-quarter view.',
    title: 'Seated Pose Reference: Sideways on a Stool with Crossed Legs',
    summary: 'A three-quarter seated study with the body turned to the side of the seat and both legs angled away.',
    paragraphs: [
      'Sitting sideways on a stool rotates the pelvis while the shoulders stay turned toward the camera, so the figure shows two different orientations at once. The legs point away from the view, one crossing over the other, and the near knee becomes the most forward point of the body.',
      'That turn is what makes the pose interesting to draw. You get the back of the hip on one side, the front of the ribs on the other, and the head can complete the twist by looking over the near shoulder. It suits a mood of relaxed independence and works well as a figure placed off center in a wide composition.',
      'The notable drawing error is a straight twist. Rotate the pelvis in relation to the ribcage by stages: hip, waist, chest, shoulder, head. If all the turn happens at the head, the body reads as a frontal block with a swivel neck. Watch the foreshortening of the far thigh, which will be much shorter than the near one, and keep the stool top visible as a line under the hip on the far side.',
    ],
    promptNotes: [
      'A three-quarter seated study with the body turned to the side of the seat and both legs angled away.',
      'The staircase rotation from hips to head is what makes the turn look natural.',
    ],
    alt: 'AI-generated seated pose reference: adult woman sitting sideways on a stool with crossed legs, three-quarter view.',
    tags: ['seated', 'stool', 'rotation', 'three-quarter view'],
    related: ['seated-crossed', 'fashion-seated', 'expressive-8', 'kneeling-upright'],
    drawingTips: [
      'Distribute the turn across hip, waist, chest and head instead of at the neck.',
      'Foreshorten the far thigh heavily compared with the near one.',
      'Leave the seat edge visible under the far hip.',
    ],
  },
  {
    id: 'floor-knees-bent',
    name: 'Seated with knees bent',
    category: 'Seated',
    tile: 3,
    sheet: 'seated-extra',
    prompt: 'Adult woman sitting on the floor with knees bent and head resting on one hand, full body.',
    title: 'Seated Pose Reference: Floor Seat with Head on One Hand',
    summary: 'A low seated figure with knees drawn up and the head propped on one hand, elbows supported by the thigh.',
    paragraphs: [
      'A floor seat changes the support completely. The weight goes through the seat and the feet, and the free arm rests an elbow on a bent knee so the head can lean on the hand. That chain, floor to pelvis, thigh to elbow, hand to head, is the structure of the whole pose and it is what makes the pose read as heavy and idle.',
      'The silhouette is a bundle rather than a column: knees up, torso folded in, one arm making a triangle between knee and temple. It gives you a low center of gravity and an intimate mood, useful for quiet scenes, close interiors, and illustration where a character is paused between actions.',
      'Draw the elbow support first; if the forearm floats without touching the knee, the head will look unsupported and the pose collapses. Keep the knees at different heights if the study shows that, and check the pelvis, which must sit visibly on the floor with the weight distributed back rather than tipped forward. The neck should remain long enough that the head still has a direction of gaze.',
    ],
    promptNotes: [
      'A low seated figure with knees drawn up and the head propped on one hand, elbows supported by the thigh.',
      'Good for quiet, low-energy beats in a sequence.',
    ],
    alt: 'AI-generated seated pose reference: adult woman sitting on the floor with knees bent and her head resting on one hand.',
    tags: ['seated', 'floor', 'head on hand', 'low'],
    related: ['cross-legged-floor', 'expressive-3', 'chair-lean-forward', 'upper-5'],
    drawingTips: [
      'Plant the elbow on the knee before placing the hand under the head.',
      'Sit the pelvis visibly on the floor with the weight carried back.',
      'Keep enough neck length for the head to have a clear gaze direction.',
    ],
  },
  {
    id: 'cross-legged-floor',
    name: 'Cross-legged on the floor',
    category: 'Seated',
    tile: 4,
    sheet: 'seated-extra',
    prompt: 'Adult woman sitting cross-legged on the floor with hands at her feet, full body, front view.',
    title: 'Seated Pose Reference: Cross-Legged on the Floor, Front View',
    summary: 'A front-facing floor seat with both legs folded in and the hands reaching down to the feet.',
    paragraphs: [
      'In cross-legged sitting the two shins fold in front of the body and the knees drop toward the floor, which widens the base and lowers the whole figure. The pelvis rests directly on the ground, the spine lengthens upward, and the arms come down between the knees toward the feet.',
      'This front view is a good test of symmetry under load. The knees are rarely exactly level and one shin usually lies in front of the other, so the doubled leg mass in the middle of the pose gives you a clear near-far overlap to solve. That makes it a useful seated reference for conversation scenes, calm character introductions, and floor-level compositions where the horizon line passes at chest height.',
      'The common mistake is drawing crossed legs as a smooth loop. Break the fold into segments: one thigh across, one ankle tucked under the opposite shin, both feet disappearing behind the calves. Check also that the knees drop below the hip height; if they sit level with the pelvis, the legs look inflated. Draw the forearms hanging inside the knee line so the hands can meet the feet without crossing the silhouette.',
    ],
    promptNotes: [
      'A front-facing floor seat with both legs folded in and the hands reaching down to the feet.',
      'The doubled leg mass in the center is the main overlap problem to solve.',
    ],
    alt: 'AI-generated seated pose reference: adult woman sitting cross-legged on the floor with her hands at her feet, front view.',
    tags: ['seated', 'floor', 'cross-legged', 'front view'],
    related: ['floor-knees-bent', 'seated-forward-fold', 'kneeling-upright', 'expressive-3'],
    drawingTips: [
      'Break the folded legs into segments instead of drawing one smooth loop.',
      'Drop the knees below hip height and keep the shins layered.',
      'Hang the forearms inside the knee line so the hands reach the feet.',
    ],
  },
  {
    id: 'kneeling-upright',
    name: 'Kneeling upright',
    category: 'Floor poses',
    tile: 5,
    sheet: 'seated-extra',
    prompt: 'Adult woman kneeling upright with hands on thighs, full body, front view.',
    title: 'Floor Pose Reference: Upright Kneel with Hands on Thighs',
    summary: 'A front-view figure kneeling on both shins with the torso vertical and the hands resting on the thighs.',
    paragraphs: [
      'Kneeling on both shins raises the body from the floor by the height of the lower leg, so the hips end up around mid-thigh height on a standing figure. The torso stays vertical, the weight distributes evenly between the two knees, and the hands rest on the thighs with the elbows relaxed.',
      'What makes this worth studying is the change in the base: instead of feet, the shins lie flat and the feet trail behind, so the silhouette narrows sharply below the knees. The vertical torso combined with the folded legs gives a quiet, formal bearing that works for ceremonial or contemplative characters and for costume studies on long garments that pool at the ground.',
      'Artists often draw a kneel with the shins still upright, which produces a crouch. The shins must lie on the ground at a shallow angle, with the feet pointing back and the toes possibly tucked under. Keep the thighs vertical and the hip crease visible where thigh meets pelvis, and check the hands: they should rest on the thighs, not clasp in front of the body.',
    ],
    promptNotes: [
      'A front-view figure kneeling on both shins with the torso vertical and the hands resting on the thighs.',
      'The key contrast is a vertical torso over a base that has folded entirely flat.',
    ],
    alt: 'AI-generated floor pose reference: adult woman kneeling upright with her hands on her thighs, front view.',
    tags: ['floor', 'kneeling', 'front view', 'formal'],
    related: ['one-knee-down', 'low-lunge', 'cross-legged-floor', 'crouching'],
    drawingTips: [
      'Lay the shins nearly flat instead of leaving them upright like a crouch.',
      'Keep the thighs vertical and show the hip crease where they meet the pelvis.',
      'Rest the hands on the thighs rather than folding them in front.',
    ],
  },
  {
    id: 'side-recline',
    name: 'Side recline',
    category: 'Floor poses',
    tile: 6,
    sheet: 'seated-extra',
    prompt: 'Adult woman lying on her side, head supported by one hand, full body.',
    title: 'Floor Pose Reference: Side-Lying with Head Propped on One Hand',
    summary: 'A long horizontal figure resting on one hip, head supported by a hand and the free arm falling forward.',
    paragraphs: [
      'Everything in a side recline runs along the ground. One hip and one shoulder take the weight, the legs stack one on top of the other with the top knee slightly forward for stability, and the upper arm folds so the hand can support the head. The whole figure becomes a long horizontal with one raised triangle at the top end.',
      'That horizontal is the main drawing value: it teaches you how a standing body reorganizes when gravity changes direction. The waist narrows visibly because the upper hip rides higher, the ribs flatten on the lower side, and clothing bunches at the ground contact along the entire length.',
      'The most common failure is drawing a standing figure tipped over. The support shoulder must compress and the shoulder joint must travel up toward the ear, while the pelvis settles onto the hip. Look carefully at the neck: the head is supported, so the neck on the underside shortens almost to nothing. Keep the top leg forward enough that the knees do not sit exactly on top of each other, and let the free arm rest along the ribs rather than float in the air.',
    ],
    promptNotes: [
      'A long horizontal figure resting on one hip, head supported by a hand and the free arm falling forward.',
      'Lying figures need an explicit pose reference; improvisation usually ends up looking tipped over.',
    ],
    alt: 'AI-generated floor pose reference: adult woman lying on her side with her head supported by one hand, full body.',
    tags: ['floor', 'reclining', 'horizontal', 'head supported'],
    related: ['reclined-knees-bent', 'floor-knees-bent', 'bridge-pose', 'downward-dog'],
    drawingTips: [
      'Compress the support shoulder so the neck on the underside shortens.',
      'Draw the top hip higher than the bottom one; the waist literally narrows.',
      'Bring the top knee forward so it does not sit exactly on the other knee.',
    ],
  },
  {
    id: 'reclined-knees-bent',
    name: 'Reclined with knees bent',
    category: 'Floor poses',
    tile: 7,
    sheet: 'seated-extra',
    prompt: 'Adult woman lying on her back with knees bent and feet on the floor, full body, side view.',
    title: 'Floor Pose Reference: Lying on the Back with Knees Bent',
    summary: 'A back-lying figure with both knees raised and feet planted, giving a low repeated-angle shape.',
    paragraphs: [
      'Lying on the back with knees up turns the body into a horizontal base and a looping shape above it. The spine rests along the floor, the pelvis is flat, and the thighs rise while the shins drop back to the planted feet. From the side, the knee becomes a peak with the feet tucked beneath it.',
      'This is the cleanest pose in the library for studying a reclining torso, because nothing overlaps the spine and the ribcage can be read across its whole length. It also gives an unambiguous ground line, which is useful when you are blocking a scene with a character on the floor, or when a figure needs to sit low under another element of the composition.',
      'One recurring error is a flat back that bends like a plank at the hips. The thighs must leave the pelvis at a real angle, and the lower back keeps its natural curve rather than being pressed into the ground. Watch the feet, which should be flat and aligned under the knees, and keep the arms from stretching stiffly straight down if the study shows them relaxed. If the knees fall together or apart, draw that asymmetry rather than forcing symmetry onto it.',
    ],
    promptNotes: [
      'A back-lying figure with both knees raised and feet planted, giving a low repeated-angle shape.',
      'The side view makes the ground line unmistakable, which helps when you block a floor composition.',
    ],
    alt: 'AI-generated floor pose reference: adult woman lying on her back with knees bent and feet on the floor, full body, side view.',
    tags: ['floor', 'reclining', 'knees bent', 'side view'],
    related: ['bridge-pose', 'side-recline', 'seated-forward-fold', 'downward-dog'],
    drawingTips: [
      'Leave a real angle at the hip so the thighs lift off the pelvis.',
      'Keep the natural curve of the lower back instead of pressing it flat.',
      'Line the feet up under the knees rather than out in front of them.',
    ],
  },
  {
    id: 'one-knee-down',
    name: 'One knee down',
    category: 'Floor poses',
    tile: 8,
    sheet: 'seated-extra',
    prompt: 'Adult woman kneeling on one knee with hands resting on her legs, full body, front view.',
    title: 'Floor Pose Reference: Kneel with One Knee Down, Front View',
    summary: 'A front-facing half kneel, one knee grounded and one knee raised, with the hands resting on the thighs.',
    paragraphs: [
      'Half kneeling splits the support between a grounded knee and a raised foot, so the pelvis is at an angle in the front view and one hip is clearly higher than the other. The torso stays upright and the hands come down onto the raised thigh, which creates a diagonal from the shoulder to the grounded knee.',
      'The asymmetry is the whole point. Compared with a symmetric kneel, this pose has one clear direction and it reads as a figure in the middle of a task: tying a lace, picking something up, proposing, checking a foot. That slight forward intent is what gives it narrative use in a single still.',
      'The classic error is a lunge that has forgotten the floor. The grounded shin must run back along the ground, not stand upright, and the raised foot must be planted flat under the raised knee. Check the hips as well: the higher hip belongs to the raised leg side, and the torso should sit over the center of the two contact points rather than over the raised foot. Hands resting on the thigh help anchor the whole upper body.',
    ],
    promptNotes: [
      'A front-facing half kneel, one knee grounded and one knee raised, with the hands resting on the thighs.',
      'Small forward intent makes this pose narratively useful for a single image.',
    ],
    alt: 'AI-generated floor pose reference: adult woman kneeling on one knee with the other knee raised and her hands on her legs, front view.',
    tags: ['floor', 'kneeling', 'asymmetric', 'front view'],
    related: ['kneeling-upright', 'low-lunge', 'crouching', 'side-lunge'],
    drawingTips: [
      'Run the grounded shin backward along the floor rather than upright.',
      'Set the raised foot flat under the raised knee.',
      'Lift the hip on the raised-leg side and center the torso over both contacts.',
    ],
  },
  {
    id: 'raised-knee-balance',
    name: 'Raised knee balance',
    category: 'Balancing',
    tile: 0,
    sheet: 'movement-extra',
    prompt: 'Adult woman balancing on one leg with the other knee raised, full body, three-quarter view.',
    title: 'Balance Pose Reference: Single-Leg Stand with a Raised Knee',
    summary: 'A standing balance with one knee lifted high in front, body upright and weight fully on the support foot.',
    paragraphs: [
      'Lifting one knee to hip height removes half the base and hands the entire job of balance to the standing ankle. The lifted thigh comes forward, the shin hangs down from it, and the standing leg works as a straight, slightly compressed post. The pelvis tilts up on the lifted side, and the torso shifts very slightly back to keep the mass over the support foot.',
      'In three-quarter view the raised knee foreshortens and points toward the viewer while the standing leg drops straight down. That crossing of a forward depth axis with a vertical is a good exercise, because you are drawing one leg coming at you and the other going away, from the same pelvis.',
      'Artists usually draw the raised thigh too low and too far out. The thigh should be close to horizontal before the shin drops, so the knee sits high and the foot hangs below it. Another easy mistake is a locked and perfectly vertical support leg; let the knee soften slightly and shift the pelvis a centimetre or two toward the support side. If the lifted foot turns in toward the standing leg, keep that in the drawing, because it tells the viewer the leg is relaxed.',
    ],
    promptNotes: [
      'A standing balance with one knee lifted high in front, body upright and weight fully on the support foot.',
      'A raised thigh near horizontal is what separates this from a low march step.',
    ],
    alt: 'AI-generated balance pose reference: adult woman standing on one leg with the other knee raised in front, three-quarter view.',
    tags: ['balancing', 'single leg', 'raised knee', 'three-quarter view'],
    related: ['tree-pose', 'airplane-balance', 'walking-step', 'standing-leg-hold'],
    drawingTips: [
      'Lift the thigh close to horizontal so the shin can hang straight down.',
      'Soften the support knee instead of locking it into a post.',
      'Foreshorten the raised knee toward the viewer while the support leg drops away.',
    ],
  },
  {
    id: 'airplane-balance',
    name: 'Airplane balance',
    category: 'Balancing',
    tile: 1,
    sheet: 'movement-extra',
    prompt: 'Adult woman balancing on one leg, torso leaning forward and arms extended sideways, full body.',
    title: 'Balance Pose Reference: Forward Lean with Arms Out and One Leg Lifted',
    summary: 'A horizontal flight shape: the torso pitches forward, the arms open sideways and the lifted leg extends behind.',
    paragraphs: [
      'Nothing else in the balancing set lies this close to horizontal. The torso tips forward until it is near level with the hips, the free leg rises behind to counterweight it, and the arms spread sideways. The support leg becomes the only vertical in the silhouette, and the rest of the body forms a cross with it.',
      'The pose is essentially a live demonstration of counterbalance, which is what makes it interesting to draw: the raised leg is not decoration but the weight that keeps the chest from falling. It also gives you a wide silhouette with very clear negative spaces above and below the arms, so it works well in a landscape format or as a figure breaking a tall page.',
      'Draw the support leg straight and the support hip as the pivot, then check the level of the head against the hips: the head usually sits slightly higher than the pelvis, so the torso is not fully horizontal. The frequent failure is a genuinely level plank from head to heel, which reads as flying rather than standing on one foot. Arms should be long and relaxed at the elbows, with the fingers extending the line.',
    ],
    promptNotes: [
      'A horizontal flight shape: the torso pitches forward, the arms open sideways and the lifted leg extends behind.',
      'The raised leg is the counterweight; keeping it high makes the whole balance legible.',
    ],
    alt: 'AI-generated balance pose reference: adult woman balancing on one leg with her torso leaning forward, arms extended sideways and the other leg lifted behind.',
    tags: ['balancing', 'counterweight', 'horizontal', 'arms out'],
    related: ['dancer-pose', 'raised-knee-balance', 'standing-t-pose', 'standing-leg-hold'],
    drawingTips: [
      'Keep the support leg as the only true vertical in the pose.',
      'Set the head slightly above the pelvis so the torso is not perfectly level.',
      'Extend the fingers to continue the line of the arms.',
    ],
  },
  {
    id: 'standing-leg-hold',
    name: 'Standing leg hold',
    category: 'Balancing',
    tile: 2,
    sheet: 'movement-extra',
    prompt: 'Adult woman standing on one leg, holding the other foot behind her with one hand, full body.',
    title: 'Balance Pose Reference: Standing Hold of the Back Foot',
    summary: 'A single-leg balance with one hand catching the back foot, the knee bent and the torso nearly upright.',
    paragraphs: [
      'Here the raised leg folds backward rather than forward and the same-side hand reaches back to hold the foot. That connection closes a loop behind the body: hand, ankle, bent knee, hip. Because the hold is low, the torso stays fairly upright compared with the deeper version of this shape, and the lifted knee drops below the hip line.',
      'The pose offers a good study of the back of the leg, which is the part most often drawn from memory and got wrong. You see the hamstring stretch from the hip to the raised knee, the calf shorten, and the foot turn to reach the hand. It is also a natural silhouette for a character in loose clothing, since the folded leg pushes fabric out behind the body.',
      'Make sure the grip is anatomically plausible: the hand catches the top of the foot or the ankle, which means the forearm drops and the elbow points down and back. A common error is a hand that reaches the middle of the shin, stretching the arm into an impossible length. Keep the support hip stacked over the support ankle and check the pelvis does not rotate toward the raised leg too far, or the torso will follow and lose its vertical.',
    ],
    promptNotes: [
      'A single-leg balance with one hand catching the back foot, the knee bent and the torso nearly upright.',
      'The grip should be low on the foot or ankle, not at mid-calf.',
    ],
    alt: 'AI-generated balance pose reference: adult woman standing on one leg and holding the other foot behind her with one hand.',
    tags: ['balancing', 'single leg', 'foot hold', 'back view'],
    related: ['dancer-pose', 'raised-knee-balance', 'airplane-balance', 'tree-pose'],
    drawingTips: [
      'Catch the top of the foot or the ankle so the forearm can drop naturally.',
      'Show the hamstring stretch from hip to raised knee and the shortened calf.',
      'Stack the support hip over the support ankle to keep the torso upright.',
    ],
  },
  {
    id: 'walking-step',
    name: 'Walking step',
    category: 'Action',
    tile: 3,
    sheet: 'movement-extra',
    prompt: 'Adult woman walking in a natural stride, full body, side view.',
    title: 'Action Pose Reference: Natural Walk in Side View',
    summary: 'A relaxed side-view stride with the arms swinging naturally and the shoulders level.',
    paragraphs: [
      'A natural walk is a quiet exchange between two legs. At the point this study captures, one leg is forward with the heel close to the ground and the other is behind with the toe pushing off, so the hips sit between the two feet rather than over either of them. The torso stays upright, with only a slight forward pitch, and the arms swing in opposition to the legs.',
      'Side view makes it a clean reference for two things artists often skip: the height of the hips at mid-stride, which is higher than at the contact moment, and the shape of the back leg, which is straight from hip to heel with the ankle extended. The pose is deliberately ordinary, which is why it is a good base for scene work and character walk cycles.',
      'The mistake is drawing the legs as an even A shape with the torso dead upright. Give the swing arm a gentle bend at the elbow, drop the shoulder on the forward-arm side, and check that the forward foot is not thrown so far ahead that the knee straightens completely. The head should lead the stride slightly, not sit between the shoulders like a ball on a stick.',
    ],
    promptNotes: [
      'A relaxed side-view stride with the arms swinging naturally and the shoulders level.',
      'Neutral walk references are the best base for character walk cycles.',
    ],
    alt: 'AI-generated action pose reference: adult woman walking in a natural stride, full body, side view.',
    tags: ['action', 'walking', 'side view', 'neutral'],
    related: ['walking', 'fashion-walk', 'running', 'running-stride'],
    drawingTips: [
      'Bend the forward elbow slightly and drop the shoulder on that side.',
      'Keep the forward knee from locking by not throwing the foot too far ahead.',
      'Let the head lean into the stride slightly ahead of the shoulders.',
    ],
  },
  {
    id: 'running-stride',
    name: 'Running stride',
    category: 'Action',
    tile: 4,
    sheet: 'movement-extra',
    prompt: 'Adult woman running with bent arms, full body, three-quarter view.',
    title: 'Action Pose Reference: Running with Bent Arms, Three-Quarter View',
    summary: 'A three-quarter running figure with the elbows held bent and the legs driving in opposition.',
    paragraphs: [
      'Bent elbows change the read of a run. With the forearms held at roughly a right angle, the upper arms stop swinging long and start driving forward and back, which pulls the shoulders into the movement and lifts the chest. In three-quarter view you also see the twist: the forward knee and the opposite elbow come toward the viewer together.',
      'The study is good for characters in motion that still need to read as controlled: pursuit, a sprint across a street, a determined entrance. Because the elbows stay close to the body, the silhouette is compact at the middle and open at the limbs, which holds up when the image is scaled down.',
      'Watch the hips in the drawing. A run is not a fast walk with bent arms; the pelvis rotates more strongly and the trailing leg folds up behind the body rather than extending in a long line. Artists often forget the lift under the standing foot at mid-stride, which flattens the whole pose. Keep the elbows bent and close, not flared out to the sides, and check that the head is stable rather than bobbing.',
    ],
    promptNotes: [
      'A three-quarter running figure with the elbows held bent and the legs driving in opposition.',
      'Compact elbows and an open stride keep the shape readable at small sizes.',
    ],
    alt: 'AI-generated action pose reference: adult woman running with bent arms, full body, three-quarter view.',
    tags: ['action', 'running', 'three-quarter view', 'bent arms'],
    related: ['running', 'reaching-forward', 'walking-step', 'fashion-walk'],
    drawingTips: [
      'Keep the elbows bent and close to the body instead of flaring them out.',
      'Fold the trailing leg up behind the hip rather than letting it trail.',
      'Stabilize the head; a bobbing head kills the sense of speed.',
    ],
  },
  {
    id: 'reaching-forward',
    name: 'Reaching forward',
    category: 'Action',
    tile: 5,
    sheet: 'movement-extra',
    prompt: 'Adult woman leaning forward and reaching ahead with both arms, full body.',
    title: 'Action Pose Reference: Leaning Forward with Both Arms Reaching',
    summary: 'A figure pitched forward with both arms extended ahead, upper body and hands leading the pose.',
    paragraphs: [
      'Both hands lead the figure, extending ahead of a torso that has already committed forward from the hips, so the hands are the furthest point in the frame and the feet are the anchor. The torso angles over the legs and the back leg tends to straighten as the weight moves ahead, which gives a long diagonal from the rear heel through the spine to the fingertips.',
      'This shape carries intent better than almost anything else in the library. It reads as offering, catching, asking or grabbing, and the mood changes entirely depending on the height of the hands and whether the elbows are locked. That makes it one of the most useful action references for storytelling poses.',
      'The trap is a reach that does not cost the body anything. If the arms extend while the torso stays vertical, the figure looks like it is pointing rather than straining. Pitch the ribcage forward, keep the shoulder blades sliding around the ribcage as the arms go out, and watch the elbows: in a real reach they are almost straight but never locked. Also make sure the hands do not end up at eye level by accident, since that turns the pose into a defensive gesture.',
    ],
    promptNotes: [
      'A figure pitched forward with both arms extended ahead, upper body and hands leading the pose.',
      'Hand height decides the meaning; specify where the hands are relative to the shoulders.',
    ],
    alt: 'AI-generated action pose reference: adult woman leaning forward and reaching ahead with both arms, full body.',
    tags: ['action', 'reach', 'lean', 'intent'],
    related: ['running-stride', 'chair-lean-forward', 'arm-raised', 'fashion-walking-look-back'],
    drawingTips: [
      'Pitch the ribcage forward so the reach costs the body something.',
      'Keep the elbows almost straight but never locked.',
      'Place the hands deliberately relative to the shoulders; that height sets the mood.',
    ],
  },
  {
    id: 'wide-hands-on-hips',
    name: 'Wide stance',
    category: 'Standing',
    tile: 6,
    sheet: 'movement-extra',
    prompt: 'Adult woman standing with feet wide apart and hands on hips, full body.',
    title: 'Standing Pose Reference: Wide Stance with Hands on Hips',
    summary: 'A broad, planted stance with both hands on the hips and the elbows flared outward.',
    paragraphs: [
      'Feet spread and hands planted on the hips, the figure becomes a rectangle: the feet define the bottom edge, the elbows the top corners, and the head rises out of the center. Weight is shared evenly, so both legs are straight but engaged and both hips sit at the same height, with the pelvis slightly tucked to keep the torso upright.',
      'Of all the standing studies this one has the most assertive read, because the flared elbows widen the upper body and the wide feet widen the base at the same time. It is a common choice for character attitude, authority figures, and any moment where a figure needs to occupy space rather than fill it.',
      'The recurring mistake is the elbow angle. When the hands rest on the hips, the elbows point out and slightly back, not sideways to the sides, so the upper arms form a narrower triangle than most drawings suggest. Draw the wrist bend clearly, since the back of the hand meets the hip and the fingers wrap forward. Keep the feet turned out a little, and make sure the head is not perfectly aligned between the shoulders, which would make the pose read as a diagram.',
    ],
    promptNotes: [
      'A broad, planted stance with both hands on the hips and the elbows flared outward.',
      'The widest reading of the pose comes from elbows back and feet turned out together.',
    ],
    alt: 'AI-generated standing pose reference: adult woman standing with her feet wide apart and both hands on her hips, full body.',
    tags: ['standing', 'wide stance', 'hands on hips', 'assertive'],
    related: ['standing-t-pose', 'warrior-two', 'fashion-hand-on-hip', 'side-lunge'],
    drawingTips: [
      'Aim the elbows outward and slightly back rather than straight to the sides.',
      'Show the wrist break where the back of the hand meets the hip.',
      'Turn the feet out a little and avoid a perfectly centered head.',
    ],
  },
  {
    id: 'standing-arms-crossed',
    name: 'Arms crossed',
    category: 'Standing',
    tile: 7,
    sheet: 'movement-extra',
    prompt: 'Adult woman standing with arms crossed and weight shifted, full body, front view.',
    title: 'Standing Pose Reference: Crossed Arms with Shifted Weight',
    summary: 'A front-view standing figure with folded arms and the pelvis tilted onto one leg.',
    paragraphs: [
      'Folded arms and a shifted hip change the whole outline of a standing figure. The arms close the chest into a horizontal band, the elbows drop near the waist, and the shoulders come slightly forward. Meanwhile the weight settles onto one leg, so the pelvis tilts and the torso leans gently back over the support side.',
      'The pose is a good study of closed body language: everything is contained, the hands are hidden, and the head is the only part that still has a clear direction. That makes it useful for characters who are guarded, unimpressed or waiting, and for a composition where you want the middle of a figure to feel compact rather than open.',
      'Draw the fold honestly. One forearm lies over the other and the second hand tucks under the first arm, so there is a visible overlap at the elbow. Artists frequently draw both forearms at the same depth, which flattens the chest into a panel. Watch the shoulder height, which drops slightly on the side of the upper arm, and keep both feet under the hips; a shifted hip should not slide the feet into a diagonal.',
    ],
    promptNotes: [
      'A front-view standing figure with folded arms and the pelvis tilted onto one leg.',
      'Closed arms read as guarded; the head direction is what keeps the pose alive.',
    ],
    alt: 'AI-generated standing pose reference: adult woman standing with her arms crossed and her weight shifted onto one leg, front view.',
    tags: ['standing', 'crossed arms', 'closed', 'front view'],
    related: ['leaning', 'weight-shift', 'fashion-folded-arms', 'upper-6'],
    drawingTips: [
      'Overlap one forearm in front of the other and tuck the far hand under.',
      'Drop the shoulder slightly on the side of the upper arm.',
      'Keep both feet under the hips even with the pelvis shifted.',
    ],
  },
  {
    id: 'standing-t-pose',
    name: 'Arms extended',
    category: 'Standing',
    tile: 8,
    sheet: 'movement-extra',
    prompt: 'Adult woman standing with both arms extended sideways, full body, front view.',
    title: 'Standing Pose Reference: Front Figure with Arms Extended Sideways',
    summary: 'A symmetrical front view with both arms held out horizontally, giving an open cross shape.',
    paragraphs: [
      'Held out at shoulder height, both arms turn the figure into a cross. The feet are together or nearly so, the torso is vertical, and the arms run along one horizontal line through the shoulders. Nothing overlaps, so widths at the neck, chest, waist and hips are all fully visible.',
      'This is an openly schematic pose, and that is its use: it isolates the shoulder girdle and the length of the arm against the torso. You can measure how far the fingertips sit below the hip line when the arm hangs, then rotate the same arm up ninety degrees and see the shoulder joint move in relation to the ribs. For costume work it also shows how a garment falls from an open arm line.',
      'The drawing error is a horizontal line that ignores the body. Arms do not travel perfectly level; they drop a little from the shoulder, the elbow has a soft angle, and the hands are slightly below the shoulder in most relaxed versions. Draw the trapezius rising from the neck to the shoulder before you draw the arm, so the deltoid has somewhere to attach. Keep the head facing forward, and check that both hands are the same size, since perspective distortion is not available in a flat front view.',
    ],
    promptNotes: [
      'A symmetrical front view with both arms held out horizontally, giving an open cross shape.',
      'A measurement pose: useful for comparing arm length against torso landmarks.',
    ],
    alt: 'AI-generated standing pose reference: adult woman standing facing the camera with both arms extended sideways, full body.',
    tags: ['standing', 'arms out', 'front view', 'proportions'],
    related: ['mountain-pose', 'wide-hands-on-hips', 'overhead-stretch', 'airplane-balance'],
    drawingTips: [
      'Draw the trapezius slope first so the deltoid has an attachment.',
      'Let the arms drop very slightly from the shoulder instead of a dead level line.',
      'Give the elbow a soft angle and keep both hands the same size.',
    ],
  },
  {
    id: 'fashion-hands-in-pockets',
    name: 'Hands in pockets',
    category: 'Fashion',
    tile: 0,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing with hands in pockets, full body, front view.',
    title: 'Fashion Pose Reference: Standing with Hands in Pockets',
    summary: 'A relaxed front-facing stance with both hands buried in pockets, shoulders dropped and the torso slightly closed.',
    paragraphs: [
      'Putting both hands in pockets pulls the shoulders forward and down, shortens the apparent arm length, and gives the elbows a slight backward push. With the arms contained like that, the torso becomes the main shape, and the pose reads as casual and unbothered rather than posed.',
      'It is a useful reference for tailoring and streetwear studies in particular, because this is the pose most clothing looks natural in: the pockets, seams and shoulder line all show their real behaviour when the arms are not held away from the body. The silhouette is narrow and calm, with one vertical line from shoulder to hip on each side.',
      'Be careful with the wrists. When hands are in pockets, the forearms converge slightly and the wrists disappear behind the fabric, so the elbow becomes the last landmark before the body. Artists often draw the arms hanging straight with the hands visible mid-thigh, which is a different pose. Keep the shoulders dropped rather than raised, and if the weight is shifted, let the hip tilt show without letting the feet drift apart.',
    ],
    promptNotes: [
      'A relaxed front-facing stance with both hands buried in pockets, shoulders dropped and the torso slightly closed.',
      'Tailoring and streetwear read best with the arms contained like this.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with both hands in her pockets, front view, full body.',
    tags: ['fashion', 'hands in pockets', 'casual', 'front view'],
    related: ['fashion-casual-stance', 'expressive-4', 'fashion-crossed-ankles', 'leaning'],
    drawingTips: [
      'End the forearm at the pocket so the wrist disappears into fabric.',
      'Drop the shoulders rather than lifting them toward the ears.',
      'Keep the feet close together so the relaxed read stays calm.',
    ],
  },
  {
    id: 'fashion-chair-lean',
    name: 'Relaxed chair pose',
    category: 'Fashion',
    tile: 1,
    sheet: 'fashion-extra',
    prompt: 'Adult woman sitting on a chair, leaning forward with one hand at her face, full body.',
    title: 'Fashion Pose Reference: Seated Chair Lean with a Hand at the Face',
    summary: 'A seated editorial study leaning off the chair, one elbow supported and one hand near the face.',
    paragraphs: [
      'A seated pose with a deliberate elbow line runs from the chair arm or knee up to the face. The torso angles forward and to one side, the head rests against the hand, and the other arm settles somewhere loose. That continuous line from support to jaw is what makes the pose read as intimate rather than formal.',
      'The moving hand is a classic editorial device because it directs the eye straight to the face, which is where a viewer looks first. That makes the study useful for portrait-led layouts, beauty and hair work, and character illustrations where the face is the subject and the seated pose is only there to organize the body.',
      'The technical issue is the forearm that holds the hand. It has to sit at an angle the elbow can actually reach, meaning an elbow on a knee is much lower than an elbow on a table. Draw the shoulder as a relaxed unit rather than a raised one, and check that the hand only touches the jaw or cheek, not the whole side of the head. Let the torso lean with the arm rather than staying vertical, or the gesture will look like a salute.',
    ],
    promptNotes: [
      'A seated editorial study leaning off the chair, one elbow supported and one hand near the face.',
      'The hand draws the eye to the face; keep it close to the jaw rather than over it.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman sitting on a chair and leaning forward with one hand at her face, full body.',
    tags: ['fashion', 'seated', 'hand at face', 'editorial'],
    related: ['chair-lean-forward', 'expressive-3', 'upper-5', 'fashion-seated'],
    drawingTips: [
      'Trace one continuous line from elbow support to the jaw.',
      'Lower the elbow support before you place the hand, or the arm will not reach.',
      'Lean the torso with the arm instead of holding it vertical.',
    ],
  },
  {
    id: 'fashion-hand-on-hip',
    name: 'Hand on hip',
    category: 'Fashion',
    tile: 2,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing with one hand on her hip and weight shifted, full body.',
    title: 'Fashion Pose Reference: One Hand on the Hip',
    summary: 'An asymmetric standing pose, one hand at the waist and the weight carried on the opposite leg.',
    paragraphs: [
      'Placing a single hand on the hip does two things at once: it lifts one elbow and creates a triangular opening between arm and waist, and it draws attention to the narrowest part of the figure. Combined with shifted weight, the result is a standing pose with a clear direction and a small amount of attitude.',
      'The pose works well in pairs of contrasting lines. One side of the body is a long vertical from shoulder to foot; the other side is interrupted by the elbow and softened by the bend of the free knee. That juxtaposition gives the illustrator something to hang clothing on and gives a viewer a quick read.',
      'The detail to watch is the wrist. The hand rests with fingers forward, the wrist breaks inward, and the elbow settles back behind the line of the ribs. A hand sliding up to the waist or a flat wrist instantly makes the gesture look hesitant. Also make sure the free arm responds to the weight shift instead of hanging limp and symmetric, and check that the hip the hand rests on is the higher hip, since that is what the pose is showing off.',
    ],
    promptNotes: [
      'An asymmetric standing pose, one hand at the waist and the weight carried on the opposite leg.',
      'The raised elbow defines the triangle; ask for the elbow held away from the ribs.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with one hand on her hip and her weight shifted, full body.',
    tags: ['fashion', 'hand on hip', 'asymmetric', 'standing'],
    related: ['look-over-shoulder', 'wide-hands-on-hips', 'weight-shift', 'expressive-5'],
    drawingTips: [
      'Break the wrist inward and let the elbow sit behind the rib line.',
      'Rest the hand on the higher hip, the side the pose is advertising.',
      'Bend the free knee slightly so the lower body answers the shift.',
    ],
  },
  {
    id: 'fashion-turn-back',
    name: 'Turned away',
    category: 'Fashion',
    tile: 3,
    sheet: 'fashion-extra',
    prompt: 'Adult woman turning away and looking over her shoulder, full body.',
    title: 'Fashion Pose Reference: Turning Away with a Glance Back',
    summary: 'A figure rotated mostly away from the camera, with the head turned back over one shoulder.',
    paragraphs: [
      'The back does most of the work in this turn. The torso is rotated away so you see the shoulder blades, the spine channel and the back of the hips, while the head turns back far enough to find the viewer. It is a pose built on opposition: away with the body, toward with the gaze.',
      'That makes it a strong narrative silhouette. It reads as exit, departure or a parting look, and it is also one of the best views for studying the back: the shoulder blades elevate as the arms move, the spine shows as a shallow groove, and clothing pulls across the back rather than draping smoothly.',
      'The common error is a rigid ninety-degree turn where the whole body rotates as one unit. Let the rotation happen progressively: hips first, then ribcage, then head, with the shoulders staying ahead of the pelvis in the opposite direction to the head. Watch the neck too, since turning it this far shortens the muscle on one side and pushes the shoulder up. Keep the far arm visible as a sliver so the viewer still reads a human front, not a slab.',
    ],
    promptNotes: [
      'A figure rotated mostly away from the camera, with the head turned back over one shoulder.',
      'Back views need the opposite arm visible; otherwise the figure loses its front-back cue.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman turned away from the camera and looking back over her shoulder, full body.',
    tags: ['fashion', 'back view', 'turn', 'glance'],
    related: ['look-over-shoulder', 'expressive-2', 'upper-2', 'fashion-walking-look-back'],
    drawingTips: [
      'Rotate hips, ribs and head in stages rather than turning the body as one block.',
      'Draw the spine groove and the two shoulder blades before the clothing.',
      'Leave a sliver of the far arm visible to preserve the front-back cue.',
    ],
  },
  {
    id: 'fashion-folded-arms',
    name: 'Folded arms',
    category: 'Fashion',
    tile: 4,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing with arms folded, full body, front view.',
    title: 'Fashion Pose Reference: Straight Front Stance with Folded Arms',
    summary: 'A squared-up front-facing figure with folded arms and an even stance, dead center to the camera.',
    paragraphs: [
      'Unlike the relaxed variation, here the feet are square and the body faces the camera directly, with both legs straight and the folded arms held roughly level. The pose is frontal and columnar, and the horizontal band of the forearms cuts the torso at the waist, which emphasizes the width of the shoulders above it.',
      'It is a formal, self-possessed stance, and that makes it a good base for tailored clothing: a jacket shoulders and a straight hem both read clearly when the body is not twisted. It also shows how much a horizontal can organize an otherwise plain vertical figure, useful for poster design and centered compositions.',
      'Check the fold from below. The upper hand wraps the opposite arm around the bicep, and the lower arm crosses in front of the ribs at a slight upward angle. Artists often make the band perfectly horizontal and symmetrical, which reads as a mannequin rather than a person. Also avoid a vertical neck; a small forward head with the chin slightly lowered gives the pose its guarded quality. Both feet should keep the same angle, since even a small splay breaks the square front.',
    ],
    promptNotes: [
      'A squared-up front-facing figure with folded arms and an even stance, dead center to the camera.',
      'A front square like this suits tailoring and centered poster layouts.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing facing the camera with folded arms, front view, full body.',
    tags: ['fashion', 'folded arms', 'frontal', 'tailoring'],
    related: ['standing-arms-crossed', 'leaning', 'upper-6', 'neutral-stance'],
    drawingTips: [
      'Angle the crossed forearms slightly upward instead of a dead horizontal.',
      'Push the head a little forward with the chin lowered for the guarded read.',
      'Keep both feet at the same angle to preserve the square front.',
    ],
  },
  {
    id: 'fashion-walking-look-back',
    name: 'Walking look back',
    category: 'Fashion',
    tile: 5,
    sheet: 'fashion-extra',
    prompt: 'Adult woman walking and glancing back, carrying a handbag, full body.',
    title: 'Fashion Pose Reference: Walking Away with a Glance Back',
    summary: 'A walking figure in motion with the head turned back over the shoulder and a bag hanging from one arm.',
    paragraphs: [
      'This pose combines a forward stride with a backward glance, so the surface of the body and the direction of the gaze disagree. The hips travel into the frame while the head turns back out of it, and the carried bag adds weight on one side, which lowers that shoulder and changes the arm swing.',
      'The result reads as caught mid-movement, which is why it is a staple of street photography and fashion editorial. For an illustrator it is a useful exercise in combining two separate rotation systems, legs and neck, and in letting a prop affect the body rather than hang on it as an afterthought.',
      'The mistake to avoid is a stride with static legs and a swivel head. If the body is walking, the pelvis has already started to rotate, and the head turn should be limited by that; too far back and the pose becomes a twist that a neck cannot produce. Draw the bag arm heavier and closer to the torso, and keep the far arm swinging freely, since that imbalance is what sells the carried weight.',
    ],
    promptNotes: [
      'A walking figure in motion with the head turned back over the shoulder and a bag hanging from one arm.',
      'The carried bag weights one side; keep that arm pinned close to the torso.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman walking and glancing back over her shoulder while carrying a handbag, full body.',
    tags: ['fashion', 'walking', 'glance back', 'prop'],
    related: ['fashion-walk', 'fashion-turn-back', 'walking-step', 'look-over-shoulder'],
    drawingTips: [
      'Weight the bag arm and keep it close so the shoulder drops.',
      'Limit the head turn to what the walking pelvis allows.',
      'Let the free arm swing normally to contrast with the weighted one.',
    ],
  },
  {
    id: 'fashion-casual-stance',
    name: 'Casual stance',
    category: 'Fashion',
    tile: 6,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing casually with both hands in pockets, full body.',
    title: 'Fashion Pose Reference: Casual Relaxed Stance',
    summary: 'A loose standing pose with both hands in pockets, one hip dropped and the shoulders slightly uneven.',
    paragraphs: [
      'Casual is a matter of small asymmetries. One hip drops, the shoulders follow at a different angle, and the head sits slightly off center. The hands in pockets keep the arms quiet so the torso carries the pose, and the whole figure reads as someone standing still between two moments.',
      'This study is a good reminder of how much variation a viewer tolerates in a standing pose before it looks contrived. Nothing here is dramatic, yet the three slight offsets, hip, shoulder and head, are enough to make the figure feel inhabited. It is the pose for a character sheet, for a catalogue, or for a scene where the figure is not the focus but must not look stiff.',
      'Draw the hip and shoulder tilts in opposite directions; when they match, the figure looks like it is leaning on an invisible surface. The knees should be soft with one slightly more bent, and the feet should stay close, since a casual stance rarely includes a wide base. Attack the temptation to make the arms symmetric: with both hands in pockets the elbows still sit at different heights.',
    ],
    promptNotes: [
      'A loose standing pose with both hands in pockets, one hip dropped and the shoulders slightly uneven.',
      'The pose relies on three small offsets; keep them small or it stops looking casual.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing casually with both hands in her pockets, full body.',
    tags: ['fashion', 'casual', 'relaxed', 'standing'],
    related: ['fashion-hands-in-pockets', 'expressive-9', 'weight-shift', 'fashion-crossed-ankles'],
    drawingTips: [
      'Tilt hips and shoulders in opposite directions rather than parallel.',
      'Keep the elbows at different heights even with both hands in pockets.',
      'Soften one knee more than the other to keep the stance from stiffening.',
    ],
  },
  {
    id: 'fashion-crossed-ankles',
    name: 'Crossed ankles',
    category: 'Fashion',
    tile: 7,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing with ankles crossed and hands in pockets, full body.',
    title: 'Fashion Pose Reference: Standing with Ankles Crossed',
    summary: 'A narrow standing figure with the ankles crossed and the hands out of sight in pockets.',
    paragraphs: [
      'Crossing the ankles collapses the base to a single line. One foot stands flat and square while the other rests on the outside of that ankle, with the toe pointing outward. That narrow support forces the hips to tilt noticeably, and because the hands are tucked away, the emerging silhouette is essentially one long leg line rising into a soft S through the torso.',
      'The pose reads as poised idleness and it is a classic for showing off trousers and long coats, since the narrow leg line is unobstructed. It is also a good study in balance that does not look like balancing: nothing here appears athletic, yet most of the weight is on one foot.',
      'When drawing, decide which foot is flat and which is resting, then keep the resting foot turned visibly outward, or the crossing will not read at all. The standing knee stays straight while the resting lower leg angles across, and the torso counter-leans very slightly to the standing side. A frequent error is drawing both feet flat with a crossed shin, which makes the leg look broken at the ankle.',
    ],
    promptNotes: [
      'A narrow standing figure with the ankles crossed and the hands out of sight in pockets.',
      'The narrow base is the point: keep both feet close together.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with her ankles crossed and her hands in her pockets, full body.',
    tags: ['fashion', 'crossed ankles', 'narrow base', 'poised'],
    related: ['fashion-casual-stance', 'leaning', 'fashion-hands-in-pockets', 'expressive-7'],
    drawingTips: [
      'Keep one foot flat and turn the resting foot outward so the cross reads.',
      'Straighten the standing knee and let only the resting lower leg angle across.',
      'Lean the torso slightly toward the standing side to hold the narrow base.',
    ],
  },
  {
    id: 'fashion-adjust-hair',
    name: 'Adjusting hair',
    category: 'Fashion',
    tile: 8,
    sheet: 'fashion-extra',
    prompt: 'Adult woman standing with one hand adjusting her hair, full body.',
    title: 'Fashion Pose Reference: Standing with a Hand in the Hair',
    summary: 'A standing figure with one arm raised to the hair, elbow out and the head tilted into the gesture.',
    paragraphs: [
      'One arm lifts to the head and the elbow swings out, which opens the ribcage on that side and raises the shoulder slightly. The head tends to tilt into the hand to shorten the distance, so the neck curves and the gaze moves off camera. The other arm stays low, giving the figure two different side profiles.',
      'This is a natural grooming gesture, and its value in illustration is that it reads as unposed while directing attention upward, toward the face and hair. It is a favourite for beauty, portrait and character work, and it makes a good gesture study because the raised arm brings the deltoid, scapula and clavicle into a visible relationship.',
      'Artist trouble usually starts at the shoulder. When the arm lifts, the clavicle rises and the shoulder blade rotates, so the raised arm should not appear to slide upward along a fixed torso edge. Draw the elbow well out to the side, not tucked near the ear, and check the hand: the fingers touch the hair near the temple or the crown, and the wrist bends naturally. Also watch the head tilt, which should be modest enough to keep the neck readable.',
    ],
    promptNotes: [
      'A standing figure with one arm raised to the hair, elbow out and the head tilted into the gesture.',
      'Keep the raised elbow out; tucked elbows make it read as a shrug.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with one hand raised to adjust her hair, full body.',
    tags: ['fashion', 'hand in hair', 'gesture', 'asymmetric'],
    related: ['arm-raised', 'expressive-1', 'upper-3', 'fashion-hand-on-hip'],
    drawingTips: [
      'Swing the raised elbow out so the ribcage opens on that side.',
      'Raise the clavicle and rotate the shoulder blade with the arm.',
      'Touch the hair near the temple or crown with a natural wrist break.',
    ],
  },
  {
    id: 'upper-1',
    name: 'Chin on hand',
    category: 'Upper body',
    tile: 0,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, facing forward with chin resting on one hand.',
    title: 'Upper Body Pose Reference: Chin Resting on the Hand',
    summary: 'A front-facing portrait with the chin supported on one hand, compressing the jaw into the palm.',
    paragraphs: [
      'With the chin on the hand, the head is pushed slightly up and back, and the jawline disappears for the length of the contact. The supporting forearm rises diagonally to the elbow, which sits low and forward, and that diagonal becomes the strongest line in the crop. The other shoulder stays relaxed and often sits a little lower.',
      'It is a thinking pose, and what makes it work is the compression: the cheek and chin deform against the palm, and the fingers wrap around the jaw. Because the head is lifted, the neck lengthens and the collarbones become more visible, which is one reason the pose appears so often in portrait work.',
      'The standard error is a hand that only touches the chin at a point. Real contact flattens the soft tissue, so draw the jaw moving into the palm and the fingers taking the shape of the chin rather than staying rigid. Watch the shoulder on the supporting side, which rises slightly, and keep the head from tipping so far back that the throat fills the crop.',
    ],
    promptNotes: [
      'A front-facing portrait with the chin supported on one hand, compressing the jaw into the palm.',
      'The contact point is the subject of the pose; keep the hand and jaw inside the crop.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman facing forward with her chin resting on one hand, portrait crop.',
    tags: ['upper body', 'portrait', 'chin on hand', 'forward facing'],
    related: ['upper-5', 'upper-8', 'expressive-3', 'fashion-chair-lean'],
    drawingTips: [
      'Flatten the jaw into the palm so the contact reads as weight, not a touch.',
      'Let the supporting shoulder rise slightly above the other one.',
      'Keep the head lift modest so the throat does not dominate the crop.',
    ],
  },
  {
    id: 'upper-2',
    name: 'Over the shoulder',
    category: 'Upper body',
    tile: 1,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, turning and looking over the shoulder.',
    title: 'Upper Body Pose Reference: Portrait with an Over-the-Shoulder Turn',
    summary: 'A cropped portrait where the chest stays angled away and the head turns back toward the viewer.',
    paragraphs: [
      'In a crop this tight, an over-the-shoulder turn is almost entirely a neck and clavicle study. The chest and shoulders stay rotated away, the near shoulder comes forward, and the head rotates back so the face sits over one shoulder. The line of the trapezius on the turning side stretches while the other side bunches.',
      'That opposition is what gives the portrait its energy. Because the body is not facing the viewer, the face looks like it is arriving from somewhere else, which suits portraits where expression matters more than posture, and it gives you a natural reason to show the side and back of one garment.',
      'Two errors dominate. First, the neck is drawn too wide, because the artist adds the turn on top of a frontal neck column; in reality a strong head turn narrows the visible neck and pushes the sternocleidomastoid into a diagonal. Second, the far shoulder disappears entirely, which makes the torso look flat. Keep a few centimetres of that far shoulder in the crop and check that the head does not float past the shoulder line.',
    ],
    promptNotes: [
      'A cropped portrait where the chest stays angled away and the head turns back toward the viewer.',
      'Keep the far shoulder in frame so the torso does not flatten.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman turning her head and looking over her shoulder in a portrait crop.',
    tags: ['upper body', 'portrait', 'over-the-shoulder', 'neck'],
    related: ['look-over-shoulder', 'fashion-turn-back', 'upper-7', 'expressive-2'],
    drawingTips: [
      'Narrow the visible neck and draw the diagonal of the neck muscles.',
      'Keep the chest rotation visible so the turn has somewhere to come from.',
      'Leave part of the far shoulder in frame to give the torso depth.',
    ],
  },
  {
    id: 'upper-3',
    name: 'Arm over head',
    category: 'Upper body',
    tile: 2,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, posing with one arm raised over the head.',
    title: 'Upper Body Pose Reference: Portrait with One Arm Raised Overhead',
    summary: 'A cropped figure with one arm lifted above the head, opening the armpit and lifting the ribcage.',
    paragraphs: [
      'A raised arm in a portrait crop takes up a quarter of the frame and changes the whole torso. The armpit opens, the ribcage lifts on that side, the shoulder rotates so the deltoid rolls toward the head, and the waist visibly lengthens. The other arm usually drops away, which makes the two sides of the upper body read very differently.',
      'The crop makes this pose useful for showing the full range of the shoulder, which is where figure drawings most often go wrong. You can see the clavicle angle change, the scapula rotate, and the breast and ribs respond to the stretch. It also creates an elegant open shape with a strong diagonal from the raised hand down through the opposite hip.',
      'Draw the lifted arm as a continuation of the torso rather than a limb attached above it. The elbow travels up and slightly out, and the armpit is a deep fold, not a smooth curve. When the arm is raised the shoulder loses its usual round shape and flattens, so do not reuse the same shoulder you would draw for a lowered arm. Check that the raised hand is still inside the crop and that the ribs above the raised side move outward.',
    ],
    promptNotes: [
      'A cropped figure with one arm lifted above the head, opening the armpit and lifting the ribcage.',
      'Watch the raised shoulder: it flattens instead of staying round.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman posing with one arm raised over her head, portrait crop.',
    tags: ['upper body', 'portrait', 'arm raised', 'shoulder'],
    related: ['arm-raised', 'fashion-adjust-hair', 'overhead-stretch', 'upper-1'],
    drawingTips: [
      'Fold the armpit deeply instead of drawing the arm as a smooth curve.',
      'Flatten the raised shoulder; it loses its round shape with the arm up.',
      'Let the ribs on the lifted side move outward and the waist lengthen.',
    ],
  },
  {
    id: 'upper-4',
    name: 'Side profile',
    category: 'Upper body',
    tile: 3,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, looking to the side in profile.',
    title: 'Upper Body Pose Reference: Profile Portrait',
    summary: 'A true side view of the head and shoulders, where the facial profile and the neck angle carry the drawing.',
    paragraphs: [
      'In profile, everything depends on one edge. The forehead, brow, nose, lips, chin and jaw trace a single outline, and behind it the neck runs down to a shoulder that sits forward of the ear. The far shoulder is largely hidden, and the visible torso becomes a shallow slab.',
      'This is the cleanest way to study the relationship between the head and the shoulder girdle, because nothing overlaps it. It is also the view where mistakes are most obvious: a profile drawn from front-view habits produces a flat face and a neck that starts behind the ear instead of under it.',
      'Start with the skull as a circle and place the features relative to its mass, then draw the neck rising from the ribcage to below the ear. The jaw projects forward of the neck, not directly above it. Check the shoulder line: in profile it appears narrow and slightly sloped, and the upper back curves gently outward rather than dropping straight from the neck.',
    ],
    promptNotes: [
      'A true side view of the head and shoulders, where the facial profile and the neck angle carry the drawing.',
      'Side views expose anatomy errors; keep the head mass large enough for the profile to sit on.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman in a profile view with her head turned to the side, portrait crop.',
    tags: ['upper body', 'profile', 'head study', 'neck'],
    related: ['upper-7', 'upper-2', 'expressive-9', 'fashion-walk'],
    drawingTips: [
      'Build the skull as a circle and place features off its mass.',
      'Let the jaw project forward of the neck rather than sitting above it.',
      'Slope the profile shoulder line and curve the upper back gently outward.',
    ],
  },
  {
    id: 'upper-5',
    name: 'Hand on cheek',
    category: 'Upper body',
    tile: 4,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, resting one cheek on one hand.',
    title: 'Upper Body Pose Reference: Cheek Resting in One Hand',
    summary: 'A portrait where the head leans into the palm, so the face is supported at an angle rather than lifted.',
    paragraphs: [
      'Whereas a chin rest lifts the head, a cheek rest tips it sideways as well as up. The cheekbone sinks into the heel of the palm, the fingers reach toward the temple, and the head tilts so the ear on the supported side drops toward the shoulder. The whole upper body picks up that lean.',
      'The pose reads as soft and contemplative, and it gives a face a tilt that can be hard to invent without looking broken. Because the head is pushed against the hand, one side of the jaw compresses and the mouth may shift slightly. Those small deformations are the entire charm of the pose.',
      'Draw the contact as a wide, flat area, not a point. The heel of the hand sits under the cheekbone and the fingers spread toward the hair, so the palm covers more of the face than many artists expect. Watch the supporting arm: the forearm must rise steeply to reach the face, and its elbow is usually the lowest element of the crop. Keep the head tilt supported by the neck rather than folding the neck sideways.',
    ],
    promptNotes: [
      'A portrait where the head leans into the palm, so the face is supported at an angle rather than lifted.',
      'The heel of the hand should sit under the cheekbone, wider than a single contact point.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman resting one cheek on one hand, portrait crop.',
    tags: ['upper body', 'portrait', 'cheek on hand', 'head tilt'],
    related: ['upper-1', 'floor-knees-bent', 'fashion-chair-lean', 'upper-8'],
    drawingTips: [
      'Spread the palm so the contact covers cheekbone to temple.',
      'Fold the head into the hand by bending the neck, not by tilting the whole spine.',
      'Keep the supporting elbow low and forward in the crop.',
    ],
  },
  {
    id: 'upper-6',
    name: 'Portrait with folded arms',
    category: 'Upper body',
    tile: 5,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, facing forward with folded arms.',
    title: 'Upper Body Pose Reference: Frontal Portrait with Folded Arms',
    summary: 'A square-on portrait crop closed off by crossed arms, with the shoulders brought forward.',
    paragraphs: [
      'Crossed arms in a tight crop take away the hands and much of the silhouette, leaving the face and the forearms as the two active shapes. The forearms cross below the chest, the elbows drop, and the shoulders roll forward slightly, which narrows the chest and pushes the head up a little to compensate.',
      'That closed structure is why the pose reads as withheld. It is a strong choice for a character who is evaluating the viewer, and for portrait compositions where you want attention concentrated on the face with no distraction from the hands.',
      'The drawing problem here is layering. In a frontal crop you have forearm over forearm, both sleeves crossing the body, and the shoulder line above. Sort them into three planes and keep the edges clean. Also watch the neck, which appears shorter because the shoulders have rolled forward, and make sure the head has not been sunk into the collarbones to compensate. A small amount of forward head is accurate; a disappearing neck is not.',
    ],
    promptNotes: [
      'A square-on portrait crop closed off by crossed arms, with the shoulders brought forward.',
      'Keep the arms below the chest so the face stays the subject.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman facing forward with folded arms, portrait crop.',
    tags: ['upper body', 'portrait', 'folded arms', 'frontal'],
    related: ['standing-arms-crossed', 'fashion-folded-arms', 'upper-1', 'upper-9'],
    drawingTips: [
      'Separate forearm, sleeve and shoulder into three clean planes.',
      'Roll the shoulders forward slightly to close the chest.',
      'Do not sink the head so low that the neck disappears.',
    ],
  },
  {
    id: 'upper-7',
    name: 'Looking to the side',
    category: 'Upper body',
    tile: 6,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, turning her gaze to the side.',
    title: 'Upper Body Pose Reference: Frontal Body with the Gaze Turned Aside',
    summary: 'A portrait facing near the camera while the eyes and head turn away to one side.',
    paragraphs: [
      'The smallest turn in the upper-body set keeps the shoulders roughly frontal, the head rotates only partway, and the gaze goes further than the face. That separation between chest direction, face direction and eye direction is what gives the portrait its psychological distance.',
      'For portrait artists it is a welcome change from a locked camera gaze. A subject who is not looking at the viewer reads as caught in thought or in conversation, and the partial turn keeps both eyes visible, which is easier to place on the face than a full profile.',
      'The detail that fails most often is the eyes. When the head has turned only a little, both irises should sit noticeably toward the side of their sockets, and the far eye shows less white than the near one. If you draw the pupils centered, the subject looks poised between two states. Follow the turn through the jaw and cheek as well, since a head turn rotates the whole head, not only the eyes and nose.',
    ],
    promptNotes: [
      'A portrait facing near the camera while the eyes and head turn away to one side.',
      'The eyes should travel further than the head; that gap is the pose.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman facing near the camera with her gaze turned to the side, portrait crop.',
    tags: ['upper body', 'portrait', 'gaze', 'head turn'],
    related: ['upper-4', 'upper-2', 'expressive-9', 'upper-9'],
    drawingTips: [
      'Push both irises toward the side of the eye socket, less white on the far eye.',
      'Keep the chest frontal so the head turn reads as a separate action.',
      'Follow the turn into the jaw and the cheek, not only the nose.',
    ],
  },
  {
    id: 'upper-8',
    name: 'Hands clasped',
    category: 'Upper body',
    tile: 7,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, looking down with hands clasped.',
    title: 'Upper Body Pose Reference: Portrait Looking Down with Clasped Hands',
    summary: 'A downward-tilted portrait with both hands joined in front of the chest and the shoulders rounded.',
    paragraphs: [
      'Looking down changes the whole construction of a portrait. The forehead comes toward the viewer, the eyes sit under a heavier brow, and the face foreshortens from cranium to chin. Joined hands below complete the loop: the arms meet at the center, the elbows pull together, and the shoulders round inward.',
      'This is a quieter, inward pose than the frontal portraits in the set, and it is valuable for the head-down angle, which is hard to fake because the features compress differently from a level view. It works well for contemplative or solemn characters and for any crop where the top and bottom of the figure close toward the middle.',
      'Watch the foreshortening. The distance from brow to chin shortens, the nose projects less, and the top of the head becomes visible. Many drawings keep level-view feature spacing and simply drop the eyes, which produces a face that looks flattened rather than tilted. In the hands, remember that clasping means the fingers interlace or the palms face each other, so there is a visible overlap of knuckles rather than two flat palms pressed together.',
    ],
    promptNotes: [
      'A downward-tilted portrait with both hands joined in front of the chest and the shoulders rounded.',
      'Head-down angles need real foreshortening between brow and chin.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman looking down with her hands clasped in front of her, portrait crop.',
    tags: ['upper body', 'portrait', 'looking down', 'clasped hands'],
    related: ['upper-1', 'upper-5', 'chair-lean-forward', 'upper-6'],
    drawingTips: [
      'Compress the brow-to-chin distance and show the top of the head.',
      'Round the shoulders inward so the arms meet at the center.',
      'Overlap the knuckles in the clasp instead of flattening two palms together.',
    ],
  },
  {
    id: 'upper-9',
    name: 'Forward portrait',
    category: 'Upper body',
    tile: 8,
    sheet: 'upper-extra',
    prompt: 'Adult woman, upper-body portrait, leaning forward and looking at the camera.',
    title: 'Upper Body Pose Reference: Forward-Leaning Portrait at the Camera',
    summary: 'A direct portrait where the torso tips toward the viewer and the face is brought close to the lens.',
    paragraphs: [
      'Leaning in toward the camera compresses the torso and enlarges the head relative to the shoulders. The neck extends forward, the chin may lift or drop depending on the height of the lens, and the shoulders slide forward and narrow in the crop. The gaze hits the viewer head-on.',
      'That combination, close head and reduced shoulders, produces an unusually direct portrait. It reads as approach, interest or challenge depending on the expression, and it is a useful alternative to the level and distant portraits that dominate reference sets.',
      'The mistake is drawing a normal bust and simply making it bigger. A forward lean pushes the collarbones out, captures the neck as a diagonal rather than a vertical, and starts to show the top plane of the shoulders. Check the ears, which move back as the head advances, and keep the eyes at a consistent distance from the brow whether the chin is raised or lowered. If the head is too close, the crop will cut the shoulders and lose the lean entirely.',
    ],
    promptNotes: [
      'A direct portrait where the torso tips toward the viewer and the face is brought close to the lens.',
      'Keep enough shoulder in the crop for the forward lean to be visible.',
    ],
    alt: 'AI-generated upper body pose reference: adult woman leaning forward and looking directly at the camera, portrait crop.',
    tags: ['upper body', 'portrait', 'leaning in', 'direct gaze'],
    related: ['upper-6', 'upper-7', 'chair-lean-forward', 'reaching-forward'],
    drawingTips: [
      'Run the neck as a diagonal and show the top plane of the shoulders.',
      'Push the collarbones forward as the torso tips in.',
      'Keep enough shoulder inside the crop for the lean to be legible.',
    ],
  },
  {
    id: 'expressive-1',
    name: 'Hand to hair',
    category: 'Fashion',
    tile: 0,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing with one hand raised to her hair, full body, fashion photography.',
    title: 'Fashion Pose Reference: Full-Length Pose with a Hand Raised to the Hair',
    summary: 'A full-length standing editorial pose with one hand in the hair and the rest of the body held long.',
    paragraphs: [
      'Stretched over a full-length frame, the grooming gesture turns the raised arm into a long diagonal against the body. The elbow lifts above the shoulder, the wrist folds into the hair, and the opposite arm hangs or rests so that the two sides of the figure contrast. The stance stays tall, with the hips level or slightly tilted.',
      'The pose works as editorial because the gesture is small relative to the frame: it directs attention to the head without pulling the eye off the clothes. That makes it a good reference for full-length costume work, where you want a believable human gesture anchoring a long silhouette.',
      'The drawing pitfall is proportion drift once the arm goes up. When the upper arm lifts, the shoulder joint sits higher in the silhouette and the armpit opens, which several artists compensate for by shortening the torso. Measure the raised arm against the head and the hip line instead of eyeballing it. Also make sure the standing legs remain long and quiet; if both the arm and the legs are active, the pose stops reading as a fashion study and starts looking busy.',
    ],
    promptNotes: [
      'A full-length standing editorial pose with one hand in the hair and the rest of the body held long.',
      'Small gesture, long figure: keep the legs calm so the hand stays the focal action.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing full length with one hand raised to her hair, fashion photography.',
    tags: ['fashion', 'hand in hair', 'full length', 'editorial'],
    related: ['fashion-adjust-hair', 'expressive-4', 'arm-raised', 'upper-3'],
    drawingTips: [
      'Raise the shoulder joint as the arm lifts instead of shortening the torso.',
      'Keep the legs long and still so the gesture stays the only action.',
      'Fold the wrist into the hair rather than bending the whole hand back.',
    ],
  },
  {
    id: 'expressive-2',
    name: 'Turned fashion pose',
    category: 'Fashion',
    tile: 1,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing turned away and looking over her shoulder, full body, fashion photography.',
    title: 'Fashion Pose Reference: Full-Length Turn with a Look Back',
    summary: 'A full-body figure turned mostly away from the camera, head coming back over the shoulder.',
    paragraphs: [
      'Full length changes the over-the-shoulder turn. Here the back and the hips take up the lower two thirds of the image, and the head turn sits at the top as the entry point for the eye. With the body angled away, one leg usually carries the weight and the other trails, so the figure is not just rotated but also offset.',
      'That makes the pose a good study of where the silhouette actually lives: the curve of the back, the pull of the shoulder blade as the head turns, and the line of the trailing leg. Costume references benefit especially, since the back of a garment and the way a hem hangs away from the body are visible at once.',
      'The mistake is a head that turns further than the shoulders allow. Once the ribcage is rotated away, the neck has only a limited range left, so a full frontal face on a fully turned body looks dislocated. Draw the head turn with the jaw tucked toward the shoulder and let the shoulder come up slightly. Also check that the far arm is at least partly visible; without it the turn reads as a mannequin rather than a person.',
    ],
    promptNotes: [
      'A full-body figure turned mostly away from the camera, head coming back over the shoulder.',
      'Keep the far arm visible so the turn reads as a person, not a slab.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing turned away from the camera and looking back over her shoulder, full body, fashion photography.',
    tags: ['fashion', 'turned away', 'full length', 'look back'],
    related: ['fashion-turn-back', 'look-over-shoulder', 'fashion-walking-look-back', 'upper-2'],
    drawingTips: [
      'Limit the head turn to what the rotated ribcage allows, jaw toward the shoulder.',
      'Weight one leg and let the other trail so the figure is offset, not just rotated.',
      'Let the shoulder on the turning side rise slightly.',
    ],
  },
  {
    id: 'expressive-3',
    name: 'Seated on a block',
    category: 'Fashion',
    tile: 2,
    sheet: 'expressive-extra',
    prompt: 'Adult woman sitting with crossed legs and one hand at her chin, full body, fashion photography.',
    title: 'Fashion Pose Reference: Seated with Crossed Legs and Hand at the Chin',
    summary: 'A low seated editorial pose on a block, legs crossed and one elbow raised to support the head.',
    paragraphs: [
      'Perched on a low block, the hips sit close to the floor and the knees rise above hip height, so the legs fold upward rather than extending. Crossing them pulls the knees together and shortens the visible leg dramatically. Meanwhile the elbow comes up to bring the hand to the chin, closing the upper half of the figure into a compact knot.',
      'This is one of the most compressed silhouettes in the library, which makes it a useful reference for narrow compositions or for a figure placed beside large type. It is also a strong costume pose, since a long garment on a low seat pools at the ground and the crossed knees lift the fabric into folds.',
      'Keep the low seat visible in your construction. When the block is omitted, the hips look like they are hovering, which is a very common failure with floor-level seated poses. Check that the knees are higher than the hips, that the supporting elbow connects to a knee or thigh, and that the head is not tipped so far that the chin disappears into the neck.',
    ],
    promptNotes: [
      'A low seated editorial pose on a block, legs crossed and one elbow raised to support the head.',
      'Low seats need their support plane to stay legible, or the hips appear to hover.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman sitting with crossed legs and one hand at her chin, full body, fashion photography.',
    tags: ['fashion', 'seated', 'low seat', 'compressed'],
    related: ['floor-knees-bent', 'cross-legged-floor', 'fashion-chair-lean', 'expressive-8'],
    drawingTips: [
      'Draw the low seat plane so the hips have something to rest on.',
      'Lift the knees above hip height so the legs rise rather than stretch.',
      'Connect the supporting elbow to the knee before placing the hand at the chin.',
    ],
  },
  {
    id: 'expressive-4',
    name: 'Relaxed tailored look',
    category: 'Fashion',
    tile: 3,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing with one hand in a pocket, full body, fashion photography.',
    title: 'Fashion Pose Reference: Standing with One Hand in a Pocket',
    summary: 'A standing study with a single hand tucked into a pocket and the rest of the body held asymmetric.',
    paragraphs: [
      'One hand in a pocket is the asymmetric version of the withdrawn-hands pose. That side of the body compresses, the shoulder drops, and the hip moves slightly toward the pocket hand, while the other arm stays free to swing or rest. The result is a natural one-sided lean that tailors love.',
      'The pose is a good example of how a single small action organizes a full-length figure. Because the pocket hand anchors one side, the opposite side is free to describe the long line from shoulder to foot, which is where the costume information lives: the fall of a jacket, the break of a trouser, the line of a shoe.',
      'Watch the free shoulder, which usually rises slightly as the pocket side drops; drawings that keep both shoulders level lose the whole asymmetry. The pocket arm should not look amputated, so keep the elbow visible and the forearm entering the pocket at a believable angle. If the figure is walking, the pocket hand stays fixed relative to the hip while the shoulder rotates over it, which makes a nice tension in the torso.',
    ],
    promptNotes: [
      'A standing study with a single hand tucked into a pocket and the rest of the body held asymmetric.',
      'The free side carries the costume line; keep it long and unobstructed.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with one hand in a pocket, full body, fashion photography.',
    tags: ['fashion', 'hand in pocket', 'asymmetric', 'tailoring'],
    related: ['fashion-hands-in-pockets', 'expressive-1', 'fashion-casual-stance', 'expressive-9'],
    drawingTips: [
      'Drop the pocket-side shoulder and let the free shoulder rise a little.',
      'Keep the pocket elbow visible instead of hiding the arm entirely.',
      'Hold the pocket hand fixed to the hip if the torso rotates.',
    ],
  },
  {
    id: 'expressive-5',
    name: 'Dress with hand on hip',
    category: 'Fashion',
    tile: 4,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing with one hand on her hip and legs crossed, full body, fashion photography.',
    title: 'Fashion Pose Reference: Dress Pose with Hand on Hip and Crossed Legs',
    summary: 'A dress look with a hand on the hip, the legs crossed and the weight on one foot.',
    paragraphs: [
      'Crossed legs narrow the base to a line, and the hand on the hip opens the upper half. Together they produce an hourglass: a wide, angular top built from arm and elbow, a narrow waist, and a lower body compressed into one long leg line. In a dress this reads immediately, because the hem follows that narrow lower shape.',
      'The pose is a standard for garment photography and illustration, and the mechanics are worth knowing because they decide how fabric falls. The crossed leg creates a long diagonal from hip to ankle, and the raised elbow puts tension across the bodice or top, so drapery behaves very differently on each side.',
      'The recurring failure is cross legs drawn as a standing figure with one foot out. The crossed leg must have its knee brought across the body and its foot placed outside the standing ankle, which turns the hips. Draw the hip pushed out to the standing side and the torso leaning back over it, and check the hand: fingers forward on the hip and elbow back, not the other way around. These three decisions carry the whole silhouette.',
    ],
    promptNotes: [
      'A dress look with a hand on the hip, the legs crossed and the weight on one foot.',
      'The crossed leg narrows the base; keep the standing ankle as the only ground contact.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with one hand on her hip and her legs crossed, wearing a dress, full body, fashion photography.',
    tags: ['fashion', 'dress', 'crossed legs', 'hand on hip'],
    related: ['fashion-hand-on-hip', 'expressive-6', 'expressive-7', 'fashion-crossed-ankles'],
    drawingTips: [
      'Bring the crossed knee across the body and place that foot outside the standing ankle.',
      'Push the hip out to the standing side and lean the torso back over it.',
      'Angle the hand with fingers forward and the elbow back.',
    ],
  },
  {
    id: 'expressive-6',
    name: 'Turning in a dress',
    category: 'Fashion',
    tile: 5,
    sheet: 'expressive-extra',
    prompt: 'Adult woman turning in a flowing dress with one hand near her shoulder, full body, fashion photography.',
    title: 'Fashion Pose Reference: Turning in a Flowing Dress',
    summary: 'A rotating figure in a full skirt, one hand near the shoulder, with the dress swinging around the body.',
    paragraphs: [
      'A turn with volume in the garment produces two motion systems at once: the body rotates around the spine and the dress trails behind it. The torso twists, one hand rises near the shoulder, and the hem swings outward in a fan, lagging a fraction of a second behind the hips. The pose is one still frame from a rotation.',
      'This is the study to pick when you want to draw drapery that is not simply hanging. The skirt tells you where the body just was, so it adds a time dimension to a single image, and it opens a wide shape at the lower half that balances the narrow waist and shoulders.',
      'Two errors ruin it. First, the dress is drawn as a static bell; a turning skirt is asymmetric, with folds gathering on the trailing side and the hem riding higher where the fabric is pulled. Second, the body is drawn frontal. A turn means shoulders and hips are not parallel, so pick the offset and keep it: one hip leads, the other lags. The hand near the shoulder should follow the turn direction rather than reaching forward.',
    ],
    promptNotes: [
      'A rotating figure in a full skirt, one hand near the shoulder, with the dress swinging around the body.',
      'A turning skirt is asymmetric; the trailing folds are what sell the motion.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman turning in a flowing dress with one hand near her shoulder, full body, fashion photography.',
    tags: ['fashion', 'drapery', 'motion', 'turn'],
    related: ['expressive-5', 'fashion-turn-back', 'expressive-7', 'look-over-shoulder'],
    drawingTips: [
      'Make the skirt asymmetric, with folds gathering on the trailing side.',
      'Offset shoulders and hips instead of a frontal turn.',
      'Let the hem rise where the fabric is pulled outward.',
    ],
  },
  {
    id: 'expressive-7',
    name: 'Crossed-leg fashion pose',
    category: 'Fashion',
    tile: 6,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing with legs crossed and hands in pockets, full body, fashion photography.',
    title: 'Fashion Pose Reference: Crossed Legs with Hands in Pockets',
    summary: 'A collapsed base and hidden hands, leaving a narrow S-shaped silhouette with no visible gesture.',
    paragraphs: [
      'Take a crossed-leg stance and put both hands in pockets and almost nothing is left to read except the shape. The legs converge to a single support line, the torso leans to counterbalance, and the arms disappear into the sides. What remains is a long S curve from one shoulder down to the crossed ankle.',
      'This is the most minimal pose in the library, and that minimalism is the reason to use it. With no gesture, the drawing rests entirely on proportion, weight distribution and the line of the clothing. It is a strong base for trouser and coat references and for layouts where the figure must sit quietly beside content without competing with it.',
      'The pitfall, as with all crossed-leg stances, is the support. If both feet look planted, the pose loses its tension and the legs look broken. Draw one foot flat, the other resting on the outside of its ankle, and angle the pelvis to match whichever leg carries the load. Then check the pockets: the elbows should stay slightly back, and the shoulders should not be perfectly level, or the S curve disappears.',
    ],
    promptNotes: [
      'A collapsed base and hidden hands, leaving a narrow S-shaped silhouette with no visible gesture.',
      'The most minimal read in the collection: proportion and clothing carry everything.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with her legs crossed and her hands in her pockets, full body, fashion photography.',
    tags: ['fashion', 'crossed legs', 'minimal', 'silhouette'],
    related: ['expressive-5', 'fashion-crossed-ankles', 'expressive-6', 'expressive-9'],
    drawingTips: [
      'Keep one foot flat and rest the other on the outside of its ankle.',
      'Hold the elbows slightly back with the hands inside the pockets.',
      'Offset the shoulders enough to preserve the S curve.',
    ],
  },
  {
    id: 'expressive-8',
    name: 'Leaning on a stool',
    category: 'Fashion',
    tile: 7,
    sheet: 'expressive-extra',
    prompt: 'Adult woman sitting on a stool and leaning forward, full body, fashion photography.',
    title: 'Fashion Pose Reference: Seated on a Stool, Leaning Forward',
    summary: 'A tall seat with the torso folded forward, elbows on the thighs and the head low.',
    paragraphs: [
      'On a stool, leaning forward brings the chest down over the thighs and stacks the head, shoulders and hips in a forward offset. Because there is no back to rest against, the pelvis sits at the edge of the seat and the feet take some of the load, so the figure angles forward from the base rather than folding in place.',
      'The pose reads as attentive and informal. It gives a tall visual element, since the folded upper body sits above two long legs dropping to the floor, and it shows clothing under compression: the shoulders narrow, a jacket back rounds, and trousers crease at the hip and knee.',
      'Check the seat edge and the feet together. If the stool is tall and the feet cannot reach the floor, the whole balance changes; if the feet are planted, they usually sit slightly forward of the knees to keep the torso from tipping. Draw the thigh as a clear horizontal and let the torso meet it at an acute angle. A common mistake is to keep the spine straight while leaning, which produces a plank hovering over a stool.',
    ],
    promptNotes: [
      'A tall seat with the torso folded forward, elbows on the thighs and the head low.',
      'A tall stool changes the balance; decide whether the feet reach the floor.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman sitting on a stool and leaning forward with her elbows on her thighs, full body, fashion photography.',
    tags: ['fashion', 'stool', 'seated', 'forward lean'],
    related: ['chair-lean-forward', 'fashion-seated', 'stool-crossed-leg', 'seated-crossed'],
    drawingTips: [
      'Keep the thigh horizontal and let the torso meet it at an acute angle.',
      'Plant the feet slightly forward of the knees when they reach the floor.',
      'Round the upper back as the torso folds rather than keeping a straight plank.',
    ],
  },
  {
    id: 'expressive-9',
    name: 'Looking aside',
    category: 'Fashion',
    tile: 8,
    sheet: 'expressive-extra',
    prompt: 'Adult woman standing with hands in pockets and looking to the side, full body, fashion photography.',
    title: 'Fashion Pose Reference: Standing with Hands in Pockets, Looking Aside',
    summary: 'A calm full-length stance with the body quiet and the head turned off toward one side.',
    paragraphs: [
      'Almost nothing happens in the body here and the head does the work. Hands in pockets keep the arms out of the composition, the stance is evenly weighted or only slightly shifted, and the face turns away so the figure is no longer addressing the viewer. The line of the body stays long and quiet.',
      'This is the pose that makes a figure look like it belongs to a place rather than to the camera, which is why it is used so often in street and lifestyle work. For illustration it is a good solution when a character has to be present but not central, and for full-length costume studies it leaves the whole garment line unobstructed.',
      'A head turn of this size is easy to draw badly. The chest stays frontal, so only the neck and head rotate; if the shoulders follow too far, the pose becomes a full turn and loses its quietness. In a full-length view, keep the head small relative to the body and check that the turned profile still has a readable nose and jaw rather than becoming a flat oval. Then make sure the feet remain parallel so the stance does not contradict the calm.',
    ],
    promptNotes: [
      'A calm full-length stance with the body quiet and the head turned off toward one side.',
      'Street and lifestyle feel: the figure belongs to the place, not the lens.',
    ],
    alt: 'AI-generated fashion pose reference: adult woman standing with her hands in her pockets and looking to the side, full body, fashion photography.',
    tags: ['fashion', 'looking aside', 'calm', 'full length'],
    related: ['fashion-casual-stance', 'upper-7', 'expressive-7', 'upper-4'],
    drawingTips: [
      'Rotate only the neck and head; keep the chest frontal.',
      'Keep the head proportionally small in a full-length view.',
      'Leave the turned profile with a readable nose and jaw, not a flat oval.',
    ],
  },
];

/** Series a pose belongs to in the gallery filters; mirrors the sheet groups above. */
export function seriesFor(pose: Pick<Pose, 'sheet'>): PoseSeries {
  if (pose.sheet === 'upper-extra') return 'Upper body · Solo';
  if (pose.sheet === 'fashion' || pose.sheet === 'fashion-extra' || pose.sheet === 'expressive-extra') return 'Full body · Sensual / fashion';
  return 'Full body · Standard';
}

/** Every pose with its page copy, in library order. */
export const POSES: readonly Pose[] = POSES_SOURCE.map(pose);

/**
 * Consumer-facing array for the gallery and the generator: the same 67 poses in the same order, each with its crop already
 * resolved. Both pages import this instead of keeping their own copy of the sprite-sheet table.
 */
export const poses: readonly LibraryPose[] = POSES.map((entry) => ({
  id: entry.id,
  name: entry.name,
  prompt: entry.prompt,
  category: entry.category,
  series: seriesFor(entry),
  ...poseCrop(entry.id),
}));

/** Full records (copy included) keyed by id, for pose pages that need the prose. */
export const poseLibrary: ReadonlyMap<string, Pose> = new Map(POSES.map((entry) => [entry.id, entry]));

export const POSE_BY_ID = poseLibrary;

export const POSE_CATEGORY_BY_SLUG: ReadonlyMap<string, PoseCategoryEntry> = new Map(POSE_CATEGORIES.map((entry) => [entry.slug, entry]));

/** Poses filed under one category slug, in library order. */
export function posesInCategory(slug: PoseCategoryEntry['slug']): readonly Pose[] {
  const entry = POSE_CATEGORY_BY_SLUG.get(slug);
  return entry ? POSES.filter((candidate) => candidate.category === entry.category) : [];
}

/**
 * Date of the last content change in this library (pose list, copy, or categories), as YYYY-MM-DD. Bump it whenever the
 * data above changes; the sitemap uses it as the lastmod for every pose-library-derived page, so the value stays
 * truthful instead of drifting with every deploy.
 */
export const POSE_LIBRARY_LAST_MODIFIED = '2026-11-08';
