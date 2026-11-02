import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: { handlers: { GET: () => llmsTxt(site, 'A free gallery of AI-generated figure and yoga pose references for artists and image creators.', [
    { title: 'AI Pose Gallery', path: '/', description: 'Browse, search and download pose reference illustrations.' },
    { title: 'Acceptable use policy', path: '/acceptable-use', description: 'Content and conduct rules, including sexual content, violence, hate, CSAM, deepfakes and infringement.' },
    { title: 'Privacy policy', path: '/privacy', description: 'How the site handles technical, account and payment data.' },
  ]) } },
});
