// Node contract tests use the same server-only marker alias as Next's server
// compiler. This does not replace fetch, auth or a business service at runtime.
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const marker = pathToFileURL(path.join(path.dirname(require.resolve('next/package.json')), 'dist/compiled/server-only/empty.js')).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: marker, shortCircuit: true };
  return nextResolve(specifier, context);
} });
