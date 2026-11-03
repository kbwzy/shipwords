import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(site, 'Turn flat-lay garment product photos into on-model e-commerce shots with AI: reproduce the garment faithfully on a posed model.', [
          { title: 'AI On-Model Photos', path: '/', description: 'Upload a garment photo, pick a model reference, and generate catalog-ready on-model shots.' },
          { title: 'Pricing', path: '/#pricing', description: 'One-time credit packs for on-model generation; the studio is free to try.' },
        ]),
    },
  },
});
