export type GarmentTile = {
  id: string;
  name: string;
  category: 'Tops' | 'Outerwear' | 'Dresses' | 'Knitwear' | 'Bottoms';
  detail: string;
  prompt: string;
  image: string;
  /** Which model tile best shows this garment type in the studio preview. */
  model: 'model-standing' | 'model-seated' | 'model-turn' | 'model-walking' | 'model-upper';
};

/**
 * Launch gallery: flat-lay garment tiles generated for the fidelity research run
 * (research/garment-fidelity-2026-11-03). Each entry doubles as a demo the
 * generator can reproduce, and as a prompt example for sellers uploading
 * their own product photos.
 */
export const garments: GarmentTile[] = [
  {
    id: 'text-logo-tee',
    name: 'White tee with chest logo',
    category: 'Tops',
    detail: 'Classic cotton tee with a small navy wordmark.',
    prompt: 'White cotton t-shirt with a small navy chest logo, worn with light-wash jeans and white sneakers.',
    image: '/garments/garment-g1-text-tee.jpg',
    model: 'model-standing',
  },
  {
    id: 'badge-hoodie',
    name: 'Black badge hoodie',
    category: 'Outerwear',
    detail: 'Heavyweight hoodie with a circular chest emblem.',
    prompt: 'Black heavyweight hoodie with a white circular mountain emblem, worn with black jeans.',
    image: '/garments/garment-g2-logo-hoodie.jpg',
    model: 'model-standing',
  },
  {
    id: 'floral-blouse',
    name: 'Ditsy floral blouse',
    category: 'Tops',
    detail: 'Cream satin blouse with a small rosebud print.',
    prompt: 'Cream satin blouse with a ditsy pink rosebud print, long sleeves with gathered cuffs, worn with white trousers.',
    image: '/garments/garment-g3-pattern-blouse.jpg',
    model: 'model-turn',
  },
  {
    id: 'sheer-chiffon-blouse',
    name: 'Sheer ruffle chiffon blouse',
    category: 'Tops',
    detail: 'Translucent chiffon with a ruffled placket.',
    prompt: 'Sheer white chiffon blouse with delicate ruffle trim and button front, worn with tailored trousers.',
    image: '/garments/garment-g4-sheer-chiffon.jpg',
    model: 'model-seated',
  },
];

export type ModelTile = {
  id: 'model-standing' | 'model-seated' | 'model-turn' | 'model-walking' | 'model-upper';
  name: string;
  detail: string;
  image: string;
};

/** Model tiles a seller pairs with their garment photo in the studio. */
export const models: ModelTile[] = [
  { id: 'model-standing', name: 'Standing', detail: 'Neutral front-facing catalog shot.', image: '/garments/model-standing.jpg' },
  { id: 'model-turn', name: 'Turn', detail: 'Fashion turn with a glance back.', image: '/garments/model-turn.jpg' },
  { id: 'model-seated', name: 'Seated', detail: 'Relaxed chair pose, hands on knees.', image: '/garments/model-seated.jpg' },
  { id: 'model-walking', name: 'Walking', detail: 'Natural stride in profile.', image: '/garments/model-walking.jpg' },
  { id: 'model-upper', name: 'Upper body', detail: 'Close crop for knitwear and tops.', image: '/garments/model-upper.jpg' },
];
