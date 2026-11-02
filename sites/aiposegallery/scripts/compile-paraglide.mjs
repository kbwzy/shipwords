import { compile } from '@inlang/paraglide-js';
import { installLocalInlangPluginFetch } from './local-inlang-plugin.mjs';

installLocalInlangPluginFetch();

await compile({
  project: './project.inlang',
  outdir: './src/paraglide',
  strategy: ['cookie', 'baseLocale'],
});
