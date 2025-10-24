import { IOClients, IOContext, Events } from '@vtex/api'

import MasterData, { MasterDataForAccount } from './masterData'

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
    return new MasterDataForAccount(context, account, appKey, appToken)
  }
}
