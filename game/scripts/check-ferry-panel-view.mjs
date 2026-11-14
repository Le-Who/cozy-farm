import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Optional DOM runner: pass an installed jsdom module URL, or resolve local jsdom.
// No browser profile, real save, network service or game asset is used.
const { JSDOM } = await import(process.argv[2] ?? 'jsdom');
const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
  server: { middlewareMode: true, hmr: false }, appType: 'custom',
});
try {
  const dom = new JSDOM('<!doctype html><html><body><div id="fixture"></div></body></html>', { pretendToBeVisual: true });
  const { runFerryPanelViewChecks } = await server.ssrLoadModule('/tests/helpers/ferry-panel-view-checks.ts');
  const results = runFerryPanelViewChecks(dom.window.document.querySelector('#fixture'));
  console.log(results.join('\n'));
  console.log(`${results.length} DOM assertions passed. This is not native browser or layout acceptance.`);
  dom.window.close();
} finally { await server.close(); }
