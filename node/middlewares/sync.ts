import { ServiceContext } from '@vtex/api'
import { json } from 'co-body'

import { Clients } from '../clients'
import { syncDocument, syncDocumentsInBatch } from '../services/masterDataSync'
import {AppSettings, getAppSettings} from '../utils/credentials'

const SCROLL_SIZE = 210 // As per user's request: 7 batches of 30 promises

export async function handleCreateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings: AppSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req)

  vtex.logger.info(`[SYNC] Received create trigger for document ${documentId}`)

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

export async function handleUpdateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req)

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

export async function handleManualSync(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
  const { syncDate, mdToken: currentMdToken } = (await json(ctx.req)) as {
    syncDate: string
    mdToken?: string
  }

  vtex.logger.info(
    `[SYNC] Manual sync process started for date ${syncDate} with token ${currentMdToken || 'none'}`
  )

  try {
    const scrollResponse: any = await clients.masterData.scroll({
      dataEntity: 'CL',
      fields: appSettings.syncFields,
      where: `(createdIn > ${syncDate}) OR (updatedIn > ${syncDate})`,
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
      // Call itself asynchronously to process the next batch
      await clients.events.sendEvent(
        vtex.account,
        'sync-cl-manual', // Event name should match the route name
        {syncDate, mdToken: nextMdToken}
      )
      vtex.logger.info(`[SYNC] Triggered next manual sync with token ${nextMdToken}`)
    } else {
      vtex.logger.info(`[SYNC] Manual sync process finished for date ${syncDate}`)
    }

    ctx.status = 200
    ctx.body = { message: 'Manual sync process started' }
  } catch (error) {
    vtex.logger.error({
      message: '[SYNC] Manual sync process failed',
      error,
    })
    ctx.status = 500
    ctx.body = { message: 'Manual sync process failed' }
  }

  await next()
}
