import { createServer as createViteServer, type InlineConfig } from 'vite';

// These fixture servers use ssrLoadModule, not the browser dependency graph.
export function createServer(options: InlineConfig = {}) {
  const client = options.environments?.client;
  return createViteServer({
    ...options,
    environments: {
      ...options.environments,
      client: {
        ...client,
        optimizeDeps: {
          ...client?.optimizeDeps,
          noDiscovery: true,
          include: [],
        },
      },
    },
  });
}
