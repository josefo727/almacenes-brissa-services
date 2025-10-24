import { InstanceOptions, IOContext, MasterData as VTEXMasterData, ExternalClient } from '@vtex/api'

/**
 * Master Data client for operations within the current account context.
 * Extends the default VTEX MasterData client with custom upsert logic.
 */
export default class MasterData extends VTEXMasterData {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }

  /**
   * Creates or updates a document in the current account.
   * Attempts to find existing document by ID first, then by email.
   */
  public async updateOrCreate(dataEntity: string, document: any) {
    const existing = await this.findExistingDocument(dataEntity, document)

    if (existing) {
      return this.updatePartialDocument({
        dataEntity,
        id: existing.id,
        fields: document,
      })
    }

    return this.createDocument({
      dataEntity,
      fields: document,
    })
  }

  public scroll(args: ScrollArgs) {
    return super.scrollDocuments(args)
  }

  private async findExistingDocument(dataEntity: string, document: any) {
    // Try to find by ID first
    if (document.id) {
      try {
        return await this.getDocument<any>({
          dataEntity,
          id: document.id,
          fields: ['id'],
        })
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error
        }
      }
    }

    // If not found by ID, try by email
    if (document.email) {
      const documents = await this.searchDocuments<any>({
        dataEntity,
        fields: ['id'],
        where: `email=${document.email}`,
        pagination: {
          page: 1,
          pageSize: 1,
        },
      })

      return documents.length > 0 ? documents[0] : null
    }

    return null
  }
}

/**
 * Custom Master Data client for cross-account operations.
 * Uses ExternalClient to make direct HTTP calls to specific VTEX accounts,
 * bypassing the default account context.
 */
export class MasterDataForAccount extends ExternalClient {
  constructor(
    context: IOContext,
    account: string,
    appKey: string,
    appToken: string,
    options?: InstanceOptions
  ) {
    super(`https://${account}.vtexcommercestable.com.br`, context, {
      ...options,
      headers: {
        ...options?.headers,
        'X-Vtex-Use-Https': 'true',
        'x-vtex-api-appKey': appKey,
        'x-vtex-api-appToken': appToken,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vtex.ds.v10+json',
      },
    })
  }

  /**
   * Retrieves a document by ID from the target account.
   */
  public async getDocument<T>(dataEntity: string, id: string, fields: string[]): Promise<T> {
    const params = fields.length > 0 ? { _fields: fields.join(',') } : {}

    return this.http.get<T>(
      `/api/dataentities/${dataEntity}/documents/${id}`,
      { params, metric: 'masterdata-get-document' }
    )
  }

  /**
   * Searches for documents in the target account using a where clause.
   */
  public async searchDocuments<T>(
    dataEntity: string,
    fields: string[],
    where: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<T[]> {
    const params = {
      _fields: fields.join(','),
      _where: where,
      _page: page,
      _pageSize: pageSize,
    }

    return this.http.get<T[]>(
      `/api/dataentities/${dataEntity}/search`,
      { params, metric: 'masterdata-search-documents' }
    )
  }

  /**
   * Creates or updates a document in the target account using PATCH (upsert).
   * PATCH allows manual ID specification, unlike POST which auto-generates IDs.
   */
  public async createDocument(dataEntity: string, fields: any): Promise<any> {
    return this.http.patch(
      `/api/dataentities/${dataEntity}/documents`,
      fields,
      { metric: 'masterdata-create-document' }
    )
  }

  /**
   * Updates an existing document by ID in the target account.
   */
  public async updatePartialDocument(
    dataEntity: string,
    id: string,
    fields: any
  ): Promise<any> {
    return this.http.patch(
      `/api/dataentities/${dataEntity}/documents/${id}`,
      fields,
      { metric: 'masterdata-update-document' }
    )
  }

  /**
   * Creates or updates a document in the target account.
   * Attempts to find existing document by ID first, then by email.
   * Uses PATCH to preserve the original document ID from the source account.
   */
  public async updateOrCreate(dataEntity: string, document: any): Promise<any> {
    const existing = await this.findExistingDocument(dataEntity, document)

    if (existing) {
      return this.updatePartialDocument(dataEntity, existing.id, document)
    }

    return this.createDocument(dataEntity, document)
  }

  private async findExistingDocument(dataEntity: string, document: any) {
    // Try to find by ID first
    if (document.id) {
      try {
        return await this.getDocument<any>(dataEntity, document.id, ['id'])
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error
        }
      }
    }

    // If not found by ID, try by email
    if (document.email) {
      try {
        const documents = await this.searchDocuments<any>(
          dataEntity,
          ['id'],
          `email=${document.email}`,
          1,
          1
        )

        return documents.length > 0 ? documents[0] : null
      } catch (error) {
        // Continue to create if search fails
        return null
      }
    }

    return null
  }
}

interface ScrollArgs {
  dataEntity: string
  fields: string[]
  where?: string
  sort?: string
  size?: number
  mdToken?: string
}
