import execa from 'execa'
import { packageJson } from 'mrm-core'
import { join } from 'path'
import assert from 'assert'
import { existsSync } from 'fs'

const FORBIDDEN = 'forbidden, use pnpm'
const MONOREPO_FILES = [`lerna.json`, 'pnpm-workspace.yaml']
const ONLY_ALLOW = `only-allow`

export const run = async () => {
  const pwd = process.cwd()
  const pkgPath = join(pwd, './package.json')
  assert(existsSync(pkgPath), `package.json must be exist`)
  const pkg = require(pkgPath)
  let pkgMrm = packageJson(pkg)
  // 1. set only-allow
  if (!pkgMrm.get('scripts.preinstall') && isMonorepo({ cwd: pwd })) {
    const isOnlyAllowInstalled =
      pkg?.devDependencies?.[ONLY_ALLOW] || pkg?.dependencies?.[ONLY_ALLOW]
    if (!isOnlyAllowInstalled) {
      await install(ONLY_ALLOW)
      // refresh
      pkgMrm = packageJson(require(pkgPath))
    }
    pkgMrm.setScript('preinstall', 'npx only-allow pnpm')
  }
  // 2. set engines
  const pnpmVersion = `^${await geyPnpmVersion()}`
  const nodeVersion = `>= ${await getNodeVersion()}`
  pkgMrm
    .set('engines.pnpm', pnpmVersion)
    .set('engines.node', nodeVersion)
    .set('engines.yarn', FORBIDDEN)
    .set('engines.npm', FORBIDDEN)
    .save()
}

async function install(pkg: string) {
  await execa(`pnpm`, ['add', '-D', pkg], {
    stdio: 'inherit',
  })
}

async function geyPnpmVersion() {
  return (await execa(`pnpm`, ['--version'])).stdout.trim()
}

async function getNodeVersion() {
  return (await execa(`node`, ['--version'])).stdout.trim().slice(1)
}

function isMonorepo(opts: { cwd: string }) {
  return MONOREPO_FILES.some((file) => existsSync(join(opts.cwd, file)))
}