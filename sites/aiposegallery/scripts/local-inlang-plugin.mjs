import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// inlang SDK 4 loads project modules with fetch(). Keep this URL in settings.json
// and serve the pinned npm package locally so builds do not depend on a CDN.
export const LOCAL_MESSAGE_FORMAT_URL =
  'https://inlang.local/plugin-message-format.js';

let installed = false;

export function installLocalInlangPluginFetch() {
  if (installed) return;

  const pluginPath = realpathSync(
    fileURLToPath(import.meta.resolve('@inlang/plugin-message-format')),
  );
  const pluginSource = readFileSync(pluginPath, 'utf8');
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url === LOCAL_MESSAGE_FORMAT_URL) {
      return Promise.resolve(
        new Response(pluginSource, {
          headers: { 'content-type': 'text/javascript; charset=utf-8' },
          status: 200,
        }),
      );
    }

    return originalFetch(input, init);
  };

  installed = true;
}
