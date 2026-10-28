import React from 'react'

/** Zentra Studio logosu: köşeli Z, hareket çizgisi ve kıvılcım. */
export function Logo({ size = 38 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Zentra">
      <defs>
        <linearGradient id="zg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b6dff" />
          <stop offset="1" stopColor="#3fa9ff" />
        </linearGradient>
        <linearGradient id="zs" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7ff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#zg)" />
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#zg)" opacity=".0" />
      <path d="M18 19h28l-24 26h24" stroke="url(#zs)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="16" r="3.2" fill="#fff" opacity=".95" />
      <path d="M12 34h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}
