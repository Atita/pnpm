#!/usr/bin/env node
// Patch the global fs module here at the app level
import fs = require('fs')
import gfs = require('graceful-fs')

gfs.gracefulify(fs)

import loudRejection = require('loud-rejection')
loudRejection()
import path = require('path')
import updateNotifier = require('update-notifier')
import camelcase = require('camelcase')
import isCI = require('is-ci')
import {stripIndent} from 'common-tags'
import nopt = require('nopt')
import R = require('ramda')
import npm = require('npm')
import npmDefaults = require('npm/lib/config/defaults')
import '../logging/fileLogger'
import pkg from '../pnpmPkgJson'
import * as pnpmCmds from '../cmd'
import runNpm from '../cmd/runNpm'
import initReporter from '../reporter'
import pnpmPkgJson from '../pnpmPkgJson'
import getCommandFullName from '../getCommandFullName'

pnpmCmds['install-test'] = pnpmCmds.installTest

const supportedCmds = new Set([
  'install',
  'uninstall',
  'update',
  'link',
  'prune',
  'install-test',
  'run',
  'store',
  'list',
  'dislink',
  'help',
])

async function run (argv: string[]) {
  const pnpmTypes = {
    'store': path,
    'store-path': path, // DEPRECATE! store should be used
    'global-path': path,
    'network-concurrency': Number,
    'fetching-concurrency': Number,
    'lock-stale-duration': Number,
    'lock': Boolean,
    'child-concurrency': Number,
    'offline': Boolean,
    'reporter': String,
    'independent-leaves': Boolean,
    'verify-store-integrity': Boolean,
  }
  const types = R.merge(npmDefaults.types, pnpmTypes)
  const cliConf = nopt(
    types,
    npmDefaults.shorthands,
    argv,
    0 // argv should be already sliced by now
  )

  if (cliConf.version) {
    console.log(pkg.version)
    return
  }

  if (!isCI) {
    updateNotifier({
      packageName: pkg.name,
      packageVersion: pkg.version
    }).notify()
  }

  const cmd = getCommandFullName(cliConf.argv.remain[0])
  if (!supportedCmds.has(cmd)) {
    runNpm(argv)
    return Promise.resolve()
  }

  if (cliConf['dry-run']) {
    console.error(`Error: 'dry-run' is not supported yet, sorry!`)
    process.exit(1)
  }

  cliConf.save = cliConf.save || !cliConf.saveDev && !cliConf.saveOptional
  if (!cliConf['user-agent']) {
    cliConf['user-agent'] = `${pnpmPkgJson.name}/${pnpmPkgJson.version} npm/? node/${process.version} ${process.platform} ${process.arch}`
  }

  await new Promise((resolve, reject) => {
    npm.load(cliConf as any, (err: Error) => { // tslint:disable-line
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })

  const silent = npm.config.get('loglevel') === 'silent' || !npm.config.get('reporter') && isCI

  const opts = R.fromPairs(<any>R.keys(types).map(configKey => [camelcase(configKey), npm.config.get(configKey)])) // tslint:disable-line
  opts.rawNpmConfig = Object.assign.apply(Object, npm.config['list'].reverse())
  opts.bin = npm.bin
  opts.globalPrefix = path.join(npm['globalPrefix'], 'pnpm-global')
  opts.prefix = opts.global ? opts.globalPrefix : npm.prefix
  opts.packageManager = pnpmPkgJson

  initReporter(silent ? 'silent' : (<any>opts.reporter || 'default')) // tslint:disable-line

  // `pnpm install ""` is going to be just `pnpm install`
  const cliArgs = cliConf.argv.remain.slice(1).filter(Boolean)
  return pnpmCmds[cmd](cliArgs, opts, cliConf.argv.remain[0])
}

export = run

import errorHandler from '../err'
if (!module.parent) run(process.argv.slice(2)).catch(errorHandler)
