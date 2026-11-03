import { useEffect, useRef } from 'react';
import './motion-preview.css';

export function MotionPreview() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) void video.current?.play().catch(() => {});
  }, []);
  return <figure className="motion-preview">
    <video ref={video} src="/motion-preview.mp4" poster="/motion-preview.jpg" muted loop playsInline controls preload="metadata" aria-label="Experimental AI-generated yoga motion sample" />
    <figcaption><strong>AI MOTION · TEST SAMPLE</strong><span>Experimental clip; the full garment is cropped. Video generation is not yet available.</span></figcaption>
  </figure>;
}
