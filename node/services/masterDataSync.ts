import { IOContext } from '@vtex/api'
import { Clients } from '../clients'

const UPLOAD_CHUNK_SIZE = 30
const UPLOAD_DELAY_MS = 1000

export async function syncDocumentsInBatch(
  clients: Clients,
  context: IOContext,
  documents: any[],
  subAccounts: string[],
  appKey: string,
  appToken: string
) {
  for (const account of subAccounts) {
    const masterData = clients.getMasterDataForAccount(
      context,
      account,
      appKey,
      appToken
    )

    for (let i = 0; i < documents.length; i += UPLOAD_CHUNK_SIZE) {
      const chunk = documents.slice(i, i + UPLOAD_CHUNK_SIZE)
      const promises = chunk.map(async (document) => {
        try {
          return await masterData.updateOrCreate('CL', document)
        } catch (error) {
          const documentId = document.id || document.document || 'unknown'
          const errorMessage = error.response
            ? JSON.stringify(error.response.data)
            : error.message
          context.logger.error({
            message: `[SYNC] Failed to sync document ${documentId} to account ${account}`,
            error: errorMessage,
          })
        }
      })

      await Promise.all(promises)

      if (i + UPLOAD_CHUNK_SIZE < documents.length) {
        await new Promise((resolve) => setTimeout(resolve, UPLOAD_DELAY_MS))
      }
    }
  }
}

export async function syncDocument(
  clients: Clients,
  context: IOContext,
  documentId: string,
  subAccounts: string[],
  fields: string[],
  appKey: string,
  appToken: string
) {
  const document = await clients.masterData.getDocument<any>({
    dataEntity: 'CL',
    id: documentId,
    fields,
  })

  await syncDocumentsInBatch(
    clients,
    context,
    [document],
    subAccounts,
    appKey,
    appToken
  )
}
