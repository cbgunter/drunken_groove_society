import { useState } from 'react'

interface Props {
  sessionId: string
}

export default function ShareButton({ sessionId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button className="btn-ghost text-xs" onClick={handleCopy}>
      {copied ? '✓ Copied!' : '🔗 Copy link'}
    </button>
  )
}
