import { build } from 'esbuild'
import { readdirSync } from 'fs'
import { join } from 'path'

const handlerDir = 'src/handlers'
const handlers = readdirSync(handlerDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(handlerDir, f))

await build({
  entryPoints: handlers,
  bundle: true,
  platform: 'node',
  target: 'node20',
  outdir: 'dist/handlers',
  external: ['@aws-sdk/*'],
  sourcemap: false,
  minify: false,
})

console.log('Backend build complete.')
