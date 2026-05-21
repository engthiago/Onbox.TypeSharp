// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: [ './spec/**' ],
    coverage: {
      include: [ '**/src/**' ]
    }
  }
})