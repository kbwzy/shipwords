import { describe, expect, it } from 'vitest';
import { poseCropStyle } from '../src/site/pose-sheet';

describe('pose background placement', () => {
  it('uses valid positions when the image occupies the whole source', () => {
    const style = poseCropStyle({ source: '/poses/tree-pose.webp', sourceWidth: 960, sourceHeight: 1280, x: 0, y: 0, width: 960, height: 1280 });
    expect(style.backgroundPosition).toBe('0% 0%');
  });
});
