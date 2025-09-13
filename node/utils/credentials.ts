import { Apps } from '@vtex/api'

export interface AppSettings {
  appKey: string
  appToken: string
  subAccounts: string[]
  syncFields: string[]
}

export async function getAppSettings(apps: Apps): Promise<AppSettings> {
  const appId = process.env.VTEX_APP_ID ?? ''
  const settings = await apps.getAppSettings(appId)

  const subAccounts = (settings.subAccounts ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)

  const syncFields = (settings.syncFields ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)

  return {
    appKey: settings.appKey,
    appToken: settings.appToken,
    subAccounts,
    syncFields,
  }
}
