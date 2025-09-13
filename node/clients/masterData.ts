import { InstanceOptions, IOContext, MasterData as VTEXMasterData } from '@vtex/api'

export default class MasterData extends VTEXMasterData {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, options)
  }

  public async updateOrCreate(dataEntity: string, document: any) {
    let existing = null

    if (document.id) {
      try {
        existing = await this.getDocument<any>({
          dataEntity,
          id: document.id,
          fields: ['id'],
        })
      } catch (error) {
        if (error.response.status !== 404) {
          throw error
        }
      }
    }

    if (!existing && document.email) {
      const documents = await this.searchDocuments<any>({
        dataEntity,
        fields: ['id'],
        where: `email=${document.email}`,
        pagination: {
          page: 1,
          pageSize: 1,
        },
      })

      if (documents.length > 0) {
        existing = documents[0]
      }
    }

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
}

interface ScrollArgs {
  dataEntity: string
  fields: string[]
  where?: string
  sort?: string
  size?: number
  mdToken?: string
}
