/**
 * Uploads the built mini program as a WeChat "experience" version.
 *
 * Expects `npm run build:weapp` to have produced dist/ and
 * scripts/prepare-weapp-ci.mjs to have written project.config.json + the key.
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(import.meta.url)
const ci = require('miniprogram-ci')

const appid = (process.env.WEAPP_APPID || '').trim()
const keyPath = process.env.WEAPP_PRIVATE_KEY_PATH || 'private.upload.key'
const rawVersion = (process.env.WEAPP_VERSION || '0.1.0').trim().replace(/^v/, '')
const version = /^\d+\.\d+\.\d+$/.test(rawVersion) ? rawVersion : '0.1.0'
const desc = (process.env.WEAPP_DESC || 'Multica Taro').slice(0, 100)

if (!appid) {
  console.error('WEAPP_APPID is required.')
  process.exit(1)
}
if (!existsSync(keyPath)) {
  console.error(`Upload key not found at ${keyPath}. Run prepare-weapp-ci.mjs first.`)
  process.exit(1)
}

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: process.cwd(),
  privateKeyPath: keyPath,
  ignores: ['node_modules/**/*', 'src/**/*', '.github/**/*', 'scripts/**/*', 'config/**/*'],
})

const result = await ci.upload({
  project,
  version,
  desc,
  setting: {
    es6: false,
    minify: true,
    urlCheck: true,
  },
  onProgressUpdate: (task) => console.log(task),
})

console.log(`Uploaded ${appid} ${version}:`, result)
