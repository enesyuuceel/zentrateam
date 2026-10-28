import { useEffect, useState } from 'react'
import type { AppState, AgentEvent, Presence } from '../../../shared/types'
import { setSoundsEnabled } from '../lib/sounds'

export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null)
  useEffect(() => {
    window.nudge.getState().then(setState)
    return window.nudge.onStateChanged(setState)
  }, [])
  useEffect(() => { if (state) setSoundsEnabled(state.settings.sounds) }, [state?.settings.sounds])
  return state
}

export type PresenceMap = Record<string, { presence: Presence; status?: string }>

export function usePresence(): PresenceMap {
  const [p, setP] = useState<PresenceMap>({})
  useEffect(() => {
    window.nudge.getPresence().then(setP)
    return window.nudge.onEvent((e: AgentEvent) => {
      if (e.type === 'presence') setP(prev => ({ ...prev, [e.agentId]: { presence: e.presence, status: e.status } }))
    })
  }, [])
  return p
}
