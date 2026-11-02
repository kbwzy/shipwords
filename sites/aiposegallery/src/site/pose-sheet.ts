import type { CSSProperties } from 'react';

export type PoseCrop = { source: string; sourceWidth: number; sourceHeight: number; x: number; y: number; width: number; height: number };

export function poseCropStyle(crop: PoseCrop): CSSProperties {
  const ratio = crop.width / crop.height;
  return {
    backgroundImage: `url(${crop.source})`,
    backgroundSize: `${crop.sourceWidth / crop.width * 100}% ${crop.sourceHeight / crop.height * 100}%`,
    backgroundPosition: `${crop.x / (crop.sourceWidth - crop.width) * 100}% ${crop.y / (crop.sourceHeight - crop.height) * 100}%`,
    width: `${Math.min(ratio, 1) * 100}%`,
    height: `${Math.min(1 / ratio, 1) * 100}%`,
    margin: 'auto',
  };
}
