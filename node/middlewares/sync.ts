import { ServiceContext } from '@vtex/api'
import { json } from 'co-body'

import { Clients } from '../clients'
import { syncDocumentToSubAccounts } from '../services/masterDataSync'
import { getAppSettings } from '../utils/credentials'

export async function handleCreateTrigger(ctx: ServiceContext<Clients>, next: () => Promise<any>) {
  const { clients, vtex } = ctx
  const appSettings = await getAppSettings(clients.apps)
  const { Id: documentId } = await json(ctx.req)

  vtex.logger.info(`[SYNC] Received create trigger for document ${documentId}`)

  await syncDocumentToSubAccounts(
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

  await syncDocumentToSubAccounts(
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
      const scrollResponse: any = await clients.masterData.scroll({
        dataEntity: 'CL',
        fields: appSettings.syncFields,
        where: `(createdIn > ${syncDate}) OR (updatedIn > ${syncDate})`,
        size: 1000,
      })

      for (const document of scrollResponse.data) {
        await syncDocumentToSubAccounts(
          clients,
          vtex,
          document.id,
          appSettings.subAccounts,
          appSettings.syncFields,
          appSettings.appKey,
          appSettings.appToken
        )
      }

      let token = scrollResponse.mdToken

      while (token) {
        const nextScrollResponse: any = await clients.masterData.scroll({
          dataEntity: 'CL',
          fields: appSettings.syncFields,
          mdToken: token,
          size: 1000,
        })

        for (const document of nextScrollResponse.data) {
          await syncDocumentToSubAccounts(
            clients,
            vtex,
            document.id,
            appSettings.subAccounts,
            appSettings.syncFields,
            appSettings.appKey,
            appSettings.appToken
          )
        }

        token = nextScrollResponse.mdToken
      }

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