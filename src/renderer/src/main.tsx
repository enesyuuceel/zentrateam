import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/msn.css'
import { MainWindow } from './windows/MainWindow'
import { ChatWindow } from './windows/ChatWindow'
import { ConnectionsWindow } from './windows/ConnectionsWindow'
import { SettingsWindow } from './windows/SettingsWindow'
import { AgentsWindow } from './windows/AgentsWindow'

function useRoute(): string {
  const [r, setR] = useState(() => location.hash.replace(/^#/, '') || '/main')
  useEffect(() => {
    const h = (): void => setR(location.hash.replace(/^#/, '') || '/main')
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return r
}

function App(): React.JSX.Element {
  const route = useRoute()
  if (route.startsWith('/chat/')) return <ChatWindow conversationId={route.slice('/chat/'.length)} />
  if (route === '/connections') return <ConnectionsWindow />
  if (route === '/settings') return <SettingsWindow />
  if (route === '/agents') return <AgentsWindow />
  return <MainWindow />
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
