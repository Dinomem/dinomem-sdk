import { defineConfig } from 'tsup'

export default defineConfig({
  entry:     ['src/index.ts'],
  format:    ['esm', 'cjs'],
  target:    'node18',
  dts:       true,
  clean:     true,
  external:  ['ai', 'zod', '@dinomem/sdk', '@ai-sdk/provider'],
})
