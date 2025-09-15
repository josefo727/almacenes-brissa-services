import { ServiceContext, EventContext } from '@vtex/api'
import { json } from 'co-body'

import { Clients } from '../clients'
import { syncDocument, syncDocumentsInBatch } from '../services/masterDataSync'
import {AppSettings, getAppSettings} from '../utils/credentials'

const SCROLL_SIZE = 1000

export async function handleCreateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings: AppSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req)

  vtex.logger.info(`[SYNC] Received create trigger for document ${documentId}`)

  // Not awaiting this so that we can respond to the trigger quickly
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

export async function handleUpdateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req)

  vtex.logger.info(`[SYNC] Received update trigger for document ${documentId}`)

  // Not awaiting this so that we can respond to the trigger quickly
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

export async function handleManualSync(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const { syncDate } = (await json(ctx.req)) as { syncDate?: string }

  vtex.logger.info(`[SYNC] Manual sync process started for date ${syncDate || 'all'}`)

  await clients.events.sendEvent('', 'sync-cl-manual-next', { syncDate })

  ctx.status = 200
  ctx.body = { message: 'Manual sync process started' }

  await next()
}

export async function handleManualSyncNext(ctx: EventContext<Clients>) {
  const { clients, vtex, body } = ctx
  const { mdToken: currentMdToken, syncDate } = body as { mdToken?: string, syncDate?: string }

  const appSettings = await getAppSettings(clients.apps)

  vtex.logger.info(
    `[SYNC] Manual sync process continued with token ${currentMdToken || 'none'} for date ${syncDate || 'all'}`
  )

  try {
    const where = syncDate ? `(createdIn > ${syncDate}) OR (updatedIn > ${syncDate})` : undefined

    const scrollResponse: any = await clients.masterData.scroll({
      dataEntity: 'CL',
      fields: appSettings.syncFields,
      where,
      size: SCROLL_SIZE,
      mdToken: currentMdToken,
    })

    const documents = scrollResponse.data
    const nextMdToken = scrollResponse.mdToken

    if (documents.length > 0) {
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
      await clients.events.sendEvent(
        '',
        'sync-cl-manual-next',
        { mdToken: nextMdToken, syncDate }
      )
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
