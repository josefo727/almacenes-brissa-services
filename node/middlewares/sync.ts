import { ServiceContext } from '@vtex/api'
import { json } from 'co-body'

import { Clients } from '../clients'
import { syncDocument, syncDocumentsInBatch } from '../services/masterDataSync'
import { getAppSettings } from '../utils/credentials'

export async function handleCreateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
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
  const { syncDate } = await json(ctx.req)

  vtex.logger.info(`[SYNC] Manual sync process started for date ${syncDate}`)

  setImmediate(async () => {
    try {
      const documents = []
      let token = null
      let hasMoreData = true

      do {
        const scrollResponse: any = await clients.masterData.scroll({
          dataEntity: 'CL',
          fields: appSettings.syncFields,
          where: `(createdIn > ${syncDate}) OR (updatedIn > ${syncDate})`,
          size: 1000,
          mdToken: token,
        })

        documents.push(...scrollResponse.data)
        token = scrollResponse.mdToken

        if (!token) {
          hasMoreData = false
        }
      } while (hasMoreData)

      await syncDocumentsInBatch(
        clients,
        vtex,
        documents,
        appSettings.subAccounts,
        appSettings.appKey,
        appSettings.appToken
      )

      vtex.logger.info(`[SYNC] Manual sync process finished for date ${syncDate}`)
    } catch (error) {
      vtex.logger.error({
        message: '[SYNC] Manual sync process failed',
        error,
      })
    }
  })

  ctx.status = 200
  ctx.body = { message: 'Manual sync process started' }

  await next()
}
