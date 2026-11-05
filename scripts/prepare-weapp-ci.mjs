/**
 * Prepares the WeChat upload credentials for CI.
 *
 * - Rewrites `appid` in project.config.json from WEAPP_APPID (the committed
 *   file keeps a placeholder so local DevTools users are not tied to one app).
 * - Writes the upload key to a git-ignored file readable only by the runner.
 *
 * Runs on the CI checkout; neither change is committed back.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const appid = (process.env.WEAPP_APPID || '').trim()
const privateKey = process.env.WEAPP_PRIVATE_KEY || ''

if (!appid || !privateKey) {
  console.error('WEAPP_APPID and WEAPP_PRIVATE_KEY must both be set.')
  process.exit(1)
}

const configPath = 'project.config.json'
const config = JSON.parse(readFileSync(configPath, 'utf8'))
config.appid = appid
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

// Some secret managers store the key as a single line with literal \n escapes.
const normalizedKey = (privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey).trim()
writeFileSync('private.upload.key', `${normalizedKey}\n`, { mode: 0o600 })

console.log(`project.config.json appid -> ${appid}`)
