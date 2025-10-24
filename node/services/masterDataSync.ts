import { IOContext } from '@vtex/api'
import { Clients } from '../clients'

const UPLOAD_CHUNK_SIZE = 30
const UPLOAD_DELAY_MS = 1000
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 2000

const RETRYABLE_STATUS_CODES = [408, 429]

/**
 * Executes a request with exponential backoff retry logic.
 * Retries on timeout (408), rate limit (429), or server errors (5xx).
 */
async function requestWithRetry(
  context: IOContext,
  request: () => Promise<any>,
  retries = MAX_RETRIES
): Promise<any> {
  let delay = INITIAL_RETRY_DELAY_MS

  for (let i = 0; i < retries; i++) {
    try {
      return await request()
    } catch (error) {
      const shouldRetry = error.response && (
        RETRYABLE_STATUS_CODES.includes(error.response.status) ||
        error.response.status >= 500
      )

      if (shouldRetry) {
        context.logger.warn(
          `[SYNC] Attempt ${i + 1} failed. Status: ${error.response.status}. Retrying in ${delay / 1000}s...`
        )
        await sleep(delay)
        delay *= 2
      } else {
        throw error
      }
    }
  }

  throw new Error(`[SYNC] Request failed after ${retries} attempts.`)
}

/**
 * Delays execution for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Synchronizes a batch of documents from the master account to multiple sub-accounts.
 * Documents are processed in chunks with delays between batches to respect API rate limits.
 * Individual document failures are logged but don't stop the batch processing.
 *
 * @param clients - VTEX IO clients
 * @param context - IO context for logging
 * @param documents - Array of documents to sync
 * @param subAccounts - Target sub-account names
 * @param appKey - VTEX API key for authentication
 * @param appToken - VTEX API token for authentication
 */
export async function syncDocumentsInBatch(
  clients: Clients,
  context: IOContext,
  documents: any[],
  subAccounts: string[],
  appKey: string,
  appToken: string
): Promise<void> {
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
          return await requestWithRetry(
            context,
            () => masterData.updateOrCreate('CL', document)
          )
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

      // Add delay between chunks to avoid rate limiting
      if (i + UPLOAD_CHUNK_SIZE < documents.length) {
        await sleep(UPLOAD_DELAY_MS)
      }
    }
  }
}

/**
 * Synchronizes a single document from the master account to all configured sub-accounts.
 *
 * @param clients - VTEX IO clients
 * @param context - IO context for logging
 * @param documentId - ID of the document to sync
 * @param subAccounts - Target sub-account names
 * @param fields - Document fields to retrieve
 * @param appKey - VTEX API key for authentication
 * @param appToken - VTEX API token for authentication
 */
export async function syncDocument(
  clients: Clients,
  context: IOContext,
  documentId: string,
  subAccounts: string[],
  fields: string[],
  appKey: string,
  appToken: string
): Promise<void> {
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
