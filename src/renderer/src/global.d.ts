import type { NudgeApi } from '../../shared/types'

declare global {
  interface Window { nudge: NudgeApi }
}
export {}
