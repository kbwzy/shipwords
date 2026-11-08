import { poseViewFile, poseViewImage, type PoseView } from './pose-library';

export function selectedLibraryPose<T extends { id: string }>(library: readonly T[], id: string | undefined): T | null {
  return library.find((pose) => pose.id === id) ?? null;
}

export function PoseDownload({ poseId, view }: { poseId: string; view: PoseView }) {
  const label = view === 'hero' ? 'main study' : view === 'side' ? 'alternate study 1' : 'alternate study 2';
  return <a className="lib-pose-download" href={poseViewImage(poseId, view)} download={`${poseViewFile(poseId, view)}.webp`}>Download {label}</a>;
}
