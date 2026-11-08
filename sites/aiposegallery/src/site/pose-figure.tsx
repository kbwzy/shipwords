import { poseImage2x, type Pose } from '~/site/pose-library';

/**
 * One generated pose photograph. Rendered as a real <img> so image search can index the study and assistive technology gets
 * the pose's own descriptive alt text. Each pose is its own file now, so no sprite sheet is shared or cropped here; the 2x
 * variant is offered through srcSet for dense screens.
 */
export function PoseFigure({ pose, className = '', eager = false, alt, src2x }: { pose: Pick<Pose, 'id' | 'alt' | 'source'>; className?: string; eager?: boolean; alt?: string; src2x?: string }) {
  return (
    <span className={`pose-figure ${className}`.trim()}>
      <img
        src={pose.source}
        srcSet={`${pose.source} 1x, ${src2x ?? poseImage2x(pose.id)} 2x`}
        alt={alt ?? pose.alt}
        width={960}
        height={1280}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  );
}
