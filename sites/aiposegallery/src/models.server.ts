import catalog from '../site.models';

// Server only: never import this file from pages or components. site.models.ts holds the public part of each entry.
//
// This site ships no jobs-API models: site.models.ts is an empty catalog, because pose generation runs through its own
// verified /api/pose routes (src/site/pose-*.server.ts) rather than the shared jobs handler. The file exists so the launch
// check and the server-only boundary stay in one place; the provider key is a Worker secret (YIR_API_KEY) and is never here.
const models = catalog;

export default models;
