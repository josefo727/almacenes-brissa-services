import { RecorderState } from '@vtex/api'
import { AppSettings } from '../utils/credentials'

declare global {
  interface State extends RecorderState {
    appSettings: AppSettings
  }
}
