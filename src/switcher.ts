import assert = require('assert')
import path = require('path')
import childProcess = require('child_process')
import resolve = require('resolve')

export type SwitcherOptions = {
  requiredBin: string,
  bin: string,
  relativeRequirePath: string,
}

export default function switcher (opts: SwitcherOptions) {
  assert(opts, 'opts is required')
  assert(opts.requiredBin, 'opts.requiredBin is required')
  assert(opts.relativeRequirePath, 'opts.relativeRequirePath is required')
  assert(opts.bin, 'opts.bin is required')

  const local = getLocal(opts.requiredBin)
  if (!local) {
    require(opts.relativeRequirePath)
    return
  }

  const cmd = path.join(local.slice(local.lastIndexOf(`${path.sep}node_modules${path.sep}`) + 1), 'node_modules', '.bin', opts.bin)
  childProcess.spawnSync(cmd, process.argv.slice(2), {stdio: 'inherit'})
}

function getLocal(requiredBin: string) {
  try {
    return resolve.sync(requiredBin, {basedir: process.cwd()})
  } catch (err) {
    return null
  }
}
