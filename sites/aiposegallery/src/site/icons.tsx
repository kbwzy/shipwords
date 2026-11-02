import type { ReactNode, SVGProps } from 'react';

type IconName = 'mark' | 'search' | 'arrow' | 'download' | 'copy' | 'close' | 'previous' | 'next' | 'plus';

const shapes: Record<IconName, ReactNode> = {
  mark: <><path d="M6 20V4h5.5a5.5 5.5 0 0 1 0 11H6" /><path d="M13 20h5" /></>,
  search: <><circle cx="10.75" cy="10.75" r="6.25" /><path d="m15.4 15.4 4.1 4.1" /></>,
  arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
  download: <><path d="M12 3v11m-4-4 4 4 4-4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  copy: <><rect x="8" y="8" width="11" height="12" rx="1" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  previous: <path d="M20 12H5m5-5-5 5 5 5" />,
  next: <path d="M4 12h15m-5-5 5 5-5 5" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{shapes[name]}</svg>;
}
