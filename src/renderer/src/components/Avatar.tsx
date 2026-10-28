import React from 'react'
import type { Agent } from '../../../shared/types'

/** Ajan avatarı: görsel yüklenmişse onu, yoksa emojiyi renkli zeminde gösterir. */
export function Avatar({ agent, size = 24, className = '' }: { agent?: Pick<Agent, 'avatar' | 'avatarImage' | 'color'> | null; size?: number; className?: string }): React.JSX.Element {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.52) }
  if (agent?.avatarImage) {
    return <span className={`av img ${className}`} style={style}><img src={agent.avatarImage} alt="" /></span>
  }
  return <span className={`av ${className}`} style={{ ...style, background: agent?.color ? agent.color + '33' : undefined }}>{agent?.avatar ?? '🤖'}</span>
}
