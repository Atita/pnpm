import {
  PnpmOptions,
  storeStatus,
  storePrune,
} from 'supi'
import {PnpmError} from '../errorTypes'
import logger from 'pnpm-logger'
import help from './help'

class StoreStatusError extends PnpmError {
  constructor (modified: string[]) {
    super('MODIFIED_DEPENDENCY', '')
    this.modified = modified
  }
  modified: string[]
}

export default async function (input: string[], opts: PnpmOptions) {
  switch (input[0]) {
    case 'status':
      return statusCmd(opts)
    case 'prune':
      return storePrune(opts)
    default:
      help(['store'])
  }
}

async function statusCmd (opts: PnpmOptions) {
  const modifiedPkgs = await storeStatus(opts)
  if (!modifiedPkgs || !modifiedPkgs.length) {
    logger.info('Packages in the store are untouched')
    return
  }

  throw new StoreStatusError(modifiedPkgs)
}
