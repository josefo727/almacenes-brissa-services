import { ServiceContext, EventContext } from '@vtex/api'
import { json } from 'co-body'

import { Clients } from '../clients'
import { syncDocument, syncDocumentsInBatch } from '../services/masterDataSync'
import { AppSettings, getAppSettings } from '../utils/credentials'

const SCROLL_SIZE = 1000
const DATA_ENTITY = 'CL'

interface TriggerRequest {
  Id: string
}

interface ManualSyncRequest {
  syncDate?: string
}

interface ManualSyncEventBody {
  mdToken?: string
  syncDate?: string
}

/**
 * Handles Master Data create trigger.
 * Responds immediately and processes sync asynchronously (fire-and-forget).
 */
export async function handleCreateTrigger(
  ctx: ServiceContext<Clients>,
  next: () => Promise<any>
): Promise<void> {
  const { clients, vtex } = ctx
  const appSettings: AppSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req) as TriggerRequest

  vtex.logger.info(`[SYNC] Received create trigger for document ${documentId}`)

  // Fire-and-forget: respond immediately without awaiting sync
  syncDocument(
    clients,
    vtex,
    documentId,
    appSettings.subAccounts,
    appSettings.syncFields,
    appSettings.appKey,
    appSettings.appToken
  )

  ctx.status = 200
  ctx.body = { message: 'Sync process started' }

  await next()
}

/**
 * Handles Master Data update trigger.
 * Awaits sync completion before responding.
 */
export async function handleUpdateTrigger(
  ctx: ServiceContext<Clients>,
  next: () => Promise<any>
): Promise<void> {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req) as TriggerRequest

  vtex.logger.info(`[SYNC] Received update trigger for document ${documentId}`)

  await syncDocument(
    clients,
    vtex,
    documentId,
    appSettings.subAccounts,
    appSettings.syncFields,
    appSettings.appKey,
    appSettings.appToken
  )

  ctx.status = 200
  ctx.body = { message: 'Sync process started' }

  await next()
}

/**
 * Initiates a manual batch sync process.
 * Triggers the first pagination event to start the sync loop.
 */
export async function handleManualSync(
  ctx: ServiceContext<Clients>,
  next: () => Promise<any>
): Promise<void> {
  const { clients, vtex } = ctx
  const { syncDate } = await json(ctx.req) as ManualSyncRequest

  vtex.logger.info(`[SYNC] Manual sync process started for date ${syncDate || 'all'}`)

  await clients.events.sendEvent('', 'sync-cl-manual-next', { syncDate })

  ctx.status = 200
  ctx.body = { message: 'Manual sync process started' }

  await next()
}

/**
 * Processes one page of documents in the manual sync loop.
 * Uses Master Data scroll API for pagination.
 * Triggers the next event if more pages exist, forming an event-driven loop.
 */
export async function handleManualSyncNext(ctx: EventContext<Clients>): Promise<void> {
  const { clients, vtex, body } = ctx
  const { mdToken: currentMdToken, syncDate } = body as ManualSyncEventBody

  const appSettings = await getAppSettings(clients.apps)

  vtex.logger.info(
    `[SYNC] Manual sync process continued with token ${currentMdToken || 'none'} for date ${syncDate || 'all'}`
  )

  try {
    const whereClause = buildWhereClause(syncDate)

    const scrollResponse: any = await clients.masterData.scroll({
      dataEntity: DATA_ENTITY,
      fields: appSettings.syncFields,
      where: whereClause,
      size: SCROLL_SIZE,
      mdToken: currentMdToken,
    })

    const documents = scrollResponse.data as any[]
    const nextMdToken = scrollResponse.mdToken as string | undefined

    if (documents && documents.length > 0) {
      await syncDocumentsInBatch(
        clients,
        vtex,
        documents,
        appSettings.subAccounts,
        appSettings.appKey,
        appSettings.appToken
      )
    }

    if (nextMdToken) {
      await clients.events.sendEvent('', 'sync-cl-manual-next', {
        mdToken: nextMdToken,
        syncDate,
      })
      vtex.logger.info(`[SYNC] Triggered next manual sync with token ${nextMdToken}`)
    } else {
      vtex.logger.info('[SYNC] Manual sync process finished')
    }
  } catch (error) {
    vtex.logger.error({
      message: '[SYNC] Manual sync process failed',
      error,
    })
  }
}

/**
 * Builds a where clause for filtering documents by creation or update date.
 * @param syncDate - Optional date string in YYYY-MM-DD format
 * @returns Where clause string or undefined if no date is provided
 */
function buildWhereClause(syncDate?: string): string | undefined {
  if (!syncDate) {
    return undefined
  }

  return `(createdIn > ${syncDate}) OR (updatedIn > ${syncDate})`
}
