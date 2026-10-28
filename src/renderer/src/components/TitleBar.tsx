import React from 'react'
export function TitleBar({ title, showMax = true }: { title: string; showMax?: boolean }): React.JSX.Element {
  const wc = (a: 'minimize' | 'close' | 'maximize'): void => window.nudge.windowControl(a)
  return (
    <div className="titlebar">
      <div className="logo" />
      <div className="title">{title}</div>
      <div className="controls">
        <button title="Küçült" onClick={() => wc('minimize')}>_</button>
        {showMax && <button title="Büyüt" onClick={() => wc('maximize')}>□</button>}
        <button className="close" title="Kapat" onClick={() => wc('close')}>×</button>
      </div>
    </div>
  )
}
