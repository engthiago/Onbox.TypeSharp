import * as esbuild from 'esbuild';

await esbuild.build({
    bundle: true,
    minify: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    platform: 'node',
    format: 'esm',
    entryPoints: [ './src/main.ts' ],
    outfile: './dist/main.mjs'
});