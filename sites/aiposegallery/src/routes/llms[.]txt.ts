import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';
import { POSES, POSE_CATEGORIES, posesInCategory } from '~/site/pose-library';

export const Route = createFileRoute('/llms.txt')({
  server: { handlers: { GET: () => llmsTxt(site, 'A free gallery of AI-generated figure and yoga pose references for artists and image creators.', [
    { title: 'AI Pose Gallery', path: '/', description: 'Browse, search and download pose reference illustrations.' },
    { title: 'Pose reference library', path: '/poses', description: `All ${POSES.length} pose references with drawing notes, grouped into seven categories.` },
    ...POSE_CATEGORIES.map((entry) => ({ title: entry.title, path: `/poses/category/${entry.slug}`, description: `${posesInCategory(entry.slug).length} studies. ${entry.shortDescription}` })),
    ...POSES.map((pose) => ({ title: pose.title, path: `/poses/${pose.slug}`, description: pose.summary })),
    { title: 'Acceptable use policy', path: '/acceptable-use', description: 'Content and conduct rules, including sexual content, violence, hate, CSAM, deepfakes and infringement.' },
    { title: 'Privacy policy', path: '/privacy', description: 'How the site handles technical, account and payment data.' },
    { title: 'Partners', path: '/partners', description: 'Directories and launchpads that list AI Pose Gallery, with the badge links those free listings require.' },
  ]) } },
});
