import React, { useEffect, useState } from 'react'
import { useAppState, usePresence } from './components/useAppState'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './views/ChatView'
import { AgentsView } from './views/AgentsView'
import { ConnectionsView } from './views/ConnectionsView'
import { SettingsView } from './views/SettingsView'
import { sounds } from './lib/sounds'
import { Logo } from './components/Logo'
import { TeamDialog } from './components/TeamDialog'
import type { Conversation } from '../../shared/types'

export type View = 'chat' | 'agents' | 'connections' | 'settings'

export function App(): React.JSX.Element {
  const state = useAppState()
  const presence = usePresence()
  const [view, setView] = useState<View>('chat')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [teamDialog, setTeamDialog] = useState<{ existing: Conversation | null } | null>(null)

  useEffect(() => window.nudge.onNav(n => {
    if (n.view === 'team-new') { setTeamDialog({ existing: null }); return }
    if (n.view === 'team-close') { setTeamDialog(null); return }
    setView(n.view as View)
    if (n.id) setActiveId(n.id)
  }), [])

  useEffect(() => window.nudge.onEvent(e => {
    if (e.type === 'message' && e.message.from === 'agent') sounds.message()
    if (e.type === 'nudge') { setShaking(true); sounds.nudge(); setTimeout(() => setShaking(false), 600) }
  }), [])

  // Aktif sohbet silinmişse ilkine geç
  useEffect(() => {
    if (!state) return
    if (activeId && !state.conversations.some(c => c.id === activeId)) setActiveId(state.conversations[0]?.id ?? null)
    if (!activeId && state.conversations.length) setActiveId(state.conversations[0].id)
  }, [state?.conversations.length])

  const openChat = (id: string): void => { setActiveId(id); setView('chat') }

  if (!state) return <div className="app" />

  const wc = (a: 'minimize' | 'maximize' | 'close'): void => window.nudge.windowControl(a)

  return (
    <div className={`app ${shaking ? 'shake' : ''}`}>
      <div className="winctl">
        <button onClick={() => wc('minimize')} title="Küçült">─</button>
        <button onClick={() => wc('maximize')} title="Büyüt">☐</button>
        <button className="close" onClick={() => wc('close')} title="Kapat">✕</button>
      </div>

      <nav className="rail">
        <div className="brand" title="Zentra Agent Team"><Logo size={40} /></div>
        <button className={view === 'chat' ? 'active' : ''} title="Sohbetler" onClick={() => setView('chat')}>💬</button>
        <button className={view === 'agents' ? 'active' : ''} title="Ajanlar" onClick={() => setView('agents')}>🧑‍🚀</button>
        <button className={view === 'connections' ? 'active' : ''} title="Bağlantılar" onClick={() => setView('connections')}>🔌</button>
        <div className="spacer" />
        <button className={view === 'settings' ? 'active' : ''} title="Ayarlar" onClick={() => setView('settings')}>⚙️</button>
        <div className="me" title={state.settings.displayName} onClick={() => setView('settings')}>{state.settings.avatar}</div>
      </nav>

      <Sidebar state={state} presence={presence} activeId={view === 'chat' ? activeId : null} onOpen={openChat} onNewTeam={() => setTeamDialog({ existing: null })} />

      <main className="main">
        {!state.settings.hasApiKey && state.providers.length === 0 && view === 'chat' && (
          <div className={`banner ${activeId ? '' : 'top'}`}>
            <div className="notice">
              <span>🔑</span>
              <span>Hiçbir yapay zeka hesabı bağlı değil. Ücretsiz başlamak için Ayarlar → "Ücretsiz başla" (Gemini, Groq ya da Ollama).</span>
              <button className="btn sm primary" onClick={() => setView('settings')}>Ücretsiz başla</button>
            </div>
          </div>
        )}
        {view === 'chat' && <ChatView state={state} presence={presence} conversationId={activeId} onOpen={openChat} onEditTeam={c => setTeamDialog({ existing: c })} />}
        {view === 'agents' && <AgentsView state={state} presence={presence} onOpen={openChat} />}
        {view === 'connections' && <ConnectionsView state={state} />}
        {view === 'settings' && <SettingsView state={state} />}
      </main>
      {teamDialog && (
        <TeamDialog
          agents={state.agents}
          existing={teamDialog.existing}
          onClose={() => setTeamDialog(null)}
          onSave={async input => {
            if (teamDialog.existing) await window.nudge.updateTeam(teamDialog.existing.id, input)
            else { const c = await window.nudge.createConversation({ kind: 'team', projectPath: null, ...input }); openChat(c.id) }
            setTeamDialog(null)
          }}
        />
      )}
    </div>
  )
}
