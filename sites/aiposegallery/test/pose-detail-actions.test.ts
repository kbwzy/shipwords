import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PoseDownload, selectedLibraryPose } from '../src/site/pose-detail-actions';
import { poses } from '../src/site/pose-library';

describe('pose detail actions', () => {
  it('selects a known pose and ignores missing or unknown identifiers', () => {
    expect(selectedLibraryPose(poses, 'tree-pose')?.id).toBe('tree-pose');
    expect(selectedLibraryPose(poses, undefined)).toBeNull();
    expect(selectedLibraryPose(poses, 'not-a-pose')).toBeNull();
  });

  it.each(['hero', 'side', 'back'] as const)('downloads the %s image at its actual URL', (view) => {
    const html = renderToStaticMarkup(createElement(PoseDownload, { poseId: 'tree-pose', view }));
    const suffix = view === 'hero' ? '' : `--${view}`;
    expect(html).toContain(`href="/poses/tree-pose${suffix}.webp"`);
    expect(html).toContain(`download="tree-pose${suffix}.webp"`);
  });
});
