import { IOClients, IOContext, Events } from '@vtex/api'

import MasterData from './masterData'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get masterData() {
    return this.getOrSet('masterData', MasterData)
  }

  public get events() {
    return this.getOrSet('events', Events)
  }

  public getMasterDataForAccount(
    context: IOContext,
    account: string,
    appKey: string,
    appToken: string
  ) {
    return new MasterData(context, {
      headers: {
        'X-Vtex-Use-Https': 'true',
        'Proxy-Authorization': context.authToken,
        VtexIdclientAutCookie: context.authToken,
        'x-vtex-api-appKey': appKey,
        'x-vtex-api-appToken': appToken,
      },
      baseURL: `https://${account}.vtexcommercestable.com.br/api/dataentities`,
    })
  }
}
