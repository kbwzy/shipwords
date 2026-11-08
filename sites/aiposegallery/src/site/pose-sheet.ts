import type { CSSProperties } from 'react';

export type PoseCrop = { source: string; sourceWidth: number; sourceHeight: number; x: number; y: number; width: number; height: number };

export function poseCropStyle(crop: PoseCrop): CSSProperties {
  const ratio = crop.width / crop.height;
  return {
    backgroundImage: `url(${crop.source})`,
    backgroundSize: `${crop.sourceWidth / crop.width * 100}% ${crop.sourceHeight / crop.height * 100}%`,
    backgroundPosition: `${crop.sourceWidth === crop.width ? 0 : crop.x / (crop.sourceWidth - crop.width) * 100}% ${crop.sourceHeight === crop.height ? 0 : crop.y / (crop.sourceHeight - crop.height) * 100}%`,
    width: `${Math.min(ratio, 1) * 100}%`,
    height: `${Math.min(1 / ratio, 1) * 100}%`,
    margin: 'auto',
  };
}

/**
 * The same crop as a real <img>: the sheet is drawn at its full size inside a clipping frame and offset by the crop rect,
 * so the browser loads the source PNG once and image search can index the pose itself.
 */
export function poseImageStyle(crop: PoseCrop): { frame: CSSProperties; image: CSSProperties } {
  return {
    frame: { position: 'relative', overflow: 'hidden', background: 'var(--paper-deep)' },
    image: {
      position: 'absolute',
      left: `${-crop.x / crop.width * 100}%`,
      top: `${-crop.y / crop.height * 100}%`,
      width: `${crop.sourceWidth / crop.width * 100}%`,
      height: `${crop.sourceHeight / crop.height * 100}%`,
      maxWidth: 'none',
    },
  };
}
