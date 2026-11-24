import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // o pacote shared é TypeScript puro: embutido no bundle
  noExternal: ['@dihber/shared'],
});
