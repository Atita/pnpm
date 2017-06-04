import path = require('path')
import R = require('ramda')
import getContext from './getContext'
import {PnpmOptions, Package} from '../types'
import extendOptions from './extendOptions'
import getPkgDirs from '../fs/getPkgDirs'
import {fromDir as readPkgFromDir} from '../fs/readPkg'
import lock from './lock'
import removeOrphanPkgs from './removeOrphanPkgs'
import {PackageSpec} from '../resolve'
import {
  ResolvedDependencies,
  prune as pruneShrinkwrap,
} from '../fs/lockfile'

export async function prune(maybeOpts?: PnpmOptions): Promise<void> {
  const opts = extendOptions(maybeOpts)

  const ctx = await getContext(opts)

  if (opts.lock === false) {
    return run()
  }

  return lock(ctx.storePath, run, {stale: opts.lockStaleDuration})

  async function run () {
    if (!ctx.pkg) {
      throw new Error('No package.json found - cannot prune')
    }

    const pkg = !opts.production ? ctx.pkg : {
      dependencies: ctx.pkg.dependencies,
      optionalDependencies: ctx.pkg.optionalDependencies,
    } as Package

    const prunedShr = pruneShrinkwrap(ctx.shrinkwrap, pkg)

    await removeOrphanPkgs(ctx.privateShrinkwrap, prunedShr, ctx.root, ctx.storePath)
  }
}
