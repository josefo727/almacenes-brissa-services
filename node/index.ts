import type { ClientsConfig } from '@vtex/api'
import { LRUCache, method, Service } from '@vtex/api'

import { Clients } from './clients'
import { handleCreateTrigger, handleUpdateTrigger, handleManualSync, handleManualSyncNext } from './middlewares/sync'

const TIMEOUT_MS = 30000

const memoryCache = new LRUCache<string, any>({ max: 5000 })

metrics.trackCache('status', memoryCache)

const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    status: {
      memoryCache,
    },
  },
}

export default new Service({
  clients,
  routes: {
    "sync-cl-created": method({
      POST: [handleCreateTrigger],
    }),
    "sync-cl-updated": method({
      PUT: [handleUpdateTrigger],
    }),
    "sync-cl": method({
      POST: [handleManualSync],
    }),
  },
  events: {
    "sync-cl-manual-next": handleManualSyncNext,
  },
})
