import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './',
  // React Compiler (babel-plugin-react-compiler) auto-memoizes components and
  // hooks at build time, eliminating the manual React.memo/useMemo churn — this
  // is the canonical @vitejs/plugin-react v6+ wiring (reactCompilerPreset run
  // through @rolldown/plugin-babel). React 19 needs no target/runtime option.
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  build: {
    // Keep desktop packaging stable: Shiki ships many dynamic chunks by
    // default, and electron-builder can OOM scanning thousands of files.
    // Collapsing to a single chunk is intentional, so the renderer bundle is
    // large by design (~22 MB). Raise the warning ceiling above that so the
    // cosmetic "chunk larger than 500 kB" nag stays quiet, while still acting
    // as a regression alarm if the bundle balloons well past today's size.
    chunkSizeWarningLimit: 25000,
    rolldownOptions: {
      output: {
        codeSplitting: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hermes/shared': path.resolve(__dirname, '../shared/src'),
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      'react/jsx-dev-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime.js'),
      'react/jsx-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-runtime.js')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true
  },
  preview: {
    host: '127.0.0.1',
    port: 4174
  },
  // Vitest: jsdom + a setup file that shims localStorage/sessionStorage, which
  // vitest's jsdom omits under Node 25 (caused ~57 store-test failures).
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Only our renderer tests. Excludes vendored native-dep tests under
    // build/native-deps (node-pty) and the electron/*.test.cjs main-process
    // tests (run separately via `node --test`, see test:desktop:platforms).
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
})
