import { IOContext } from '@vtex/api'
import { Clients } from '../clients'

export async function syncDocumentToSubAccounts(
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

  for (const account of subAccounts) {
    const masterData = clients.getMasterDataForAccount(
      context,
      account,
      appKey,
      appToken
    )

    await masterData.updateOrCreate('CL', document)
  }
}
