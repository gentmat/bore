#!/usr/bin/env node
/**
 * Frontend Build Script
 * Compiles TypeScript frontend files to JavaScript using esbuild
 */

import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const files = [
  'login',
  'signup',
  'dashboard',
  'claim-trial',
  'viewer'
];

async function build(): Promise<void> {
  console.log('🔨 Building frontend TypeScript files...\n');
  
  const buildPromises = files.map(async (file) => {
    try {
      await esbuild.build({
        entryPoints: [path.join(process.cwd(), 'frontend-src', `${file}.ts`)],
        bundle: true,
        minify: process.env.NODE_ENV === 'production',
        sourcemap: process.env.NODE_ENV !== 'production',
        target: ['es2020'],
        outfile: path.join(process.cwd(), 'public', 'js', `${file}.js`),
        platform: 'browser',
        format: 'iife',
      });
      console.log(`✅ Built ${file}.ts → public/js/${file}.js`);
    } catch (error) {
      console.error(`❌ Failed to build ${file}.ts:`, error);
      throw error;
    }
  });

  await Promise.all(buildPromises);
  
  console.log('\n✨ Frontend build complete!\n');
}

// Watch mode
if (process.argv.includes('--watch')) {
  console.log('👀 Watching for changes...\n');
  
  files.forEach((file) => {
    const srcPath = path.join(process.cwd(), 'frontend-src', `${file}.ts`);
    
    fs.watch(srcPath, async (eventType) => {
      if (eventType === 'change') {
        console.log(`🔄 ${file}.ts changed, rebuilding...`);
        try {
          await esbuild.build({
            entryPoints: [srcPath],
            bundle: true,
            sourcemap: true,
            target: ['es2020'],
            outfile: path.join(process.cwd(), 'public', 'js', `${file}.js`),
            platform: 'browser',
            format: 'iife',
          });
          console.log(`✅ Rebuilt ${file}.ts`);
        } catch (error) {
          console.error(`❌ Build failed for ${file}.ts:`, (error as Error).message);
        }
      }
    });
  });
  
  console.log('Watching for changes... (Press Ctrl+C to stop)\n');
  
  // Keep the process running
  setInterval(() => {}, 1000);
} else {
  // Build once
  build().catch((error) => {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  });
}
