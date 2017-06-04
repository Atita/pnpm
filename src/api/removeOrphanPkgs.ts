import rimraf = require('rimraf-then')
import path = require('path')
import {
  Lockfile,
  shortIdToFullId,
} from '../fs/lockfile'
import {read as readStore, save as saveStore} from '../fs/storeController'
import R = require('ramda')
import {PackageSpec} from '../resolve'
import removeTopDependency from '../removeTopDependency'

export default async function removeOrphanPkgs (
  oldShr: Lockfile,
  newShr: Lockfile,
  root: string,
  storePath: string
): Promise<string[]> {
  const oldPkgNames = Object.keys(oldShr.dependencies)
  const newPkgNames = Object.keys(newShr.dependencies)

  const removedTopDeps = R.difference(oldPkgNames, newPkgNames)

  const rootModules = path.join(root, 'node_modules')
  await Promise.all(removedTopDeps.map(depName => removeTopDependency(depName, rootModules)))

  const oldPkgIds = Object.keys(oldShr.packages).map(shortId => shortIdToFullId(shortId, oldShr.registry))
  const newPkgIds = Object.keys(newShr.packages).map(shortId => shortIdToFullId(shortId, newShr.registry))

  const store = await readStore(storePath) || {}
  const notDependents = R.difference(oldPkgIds, newPkgIds)

  await Promise.all(Array.from(notDependents).map(async notDependent => {
    if (store[notDependent]) {
      store[notDependent].splice(store[notDependent].indexOf(root), 1)
      if (!store[notDependent].length) {
        delete store[notDependent]
        await rimraf(path.join(storePath, notDependent))
      }
    }
    await rimraf(path.join(rootModules, `.${notDependent}`))
  }))

  const newDependents = R.difference(newPkgIds, oldPkgIds)

  newDependents.forEach(newDependent => {
    store[newDependent] = store[newDependent] || []
    if (store[newDependent].indexOf(root) === -1) {
      store[newDependent].push(root)
    }
  })

  await saveStore(storePath, store)

  return notDependents
}
