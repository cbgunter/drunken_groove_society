// Minimal markdown renderer — no external deps
// Supports: headings, bold, italic, links, bullets, line breaks

export function renderMarkdown(text: string): string {
  if (!text) return ''

  const lines = text.split('\n')
  const out: string[] = []
  let inList = false

  for (const raw of lines) {
    const line = raw

    // Headings
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3 class="text-base font-semibold mt-4 mb-1">${inline(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2 class="text-lg font-semibold mt-5 mb-1">${inline(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h1 class="text-xl font-bold mt-5 mb-2">${inline(line.slice(2))}</h1>`)
      continue
    }

    // Bullets
    if (line.match(/^[-*] /)) {
      if (!inList) { out.push('<ul class="list-disc list-inside space-y-1 my-2">'); inList = true }
      out.push(`<li>${inline(line.slice(2))}</li>`)
      continue
    }

    // Blank line
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false }
      out.push('<br />')
      continue
    }

    // Paragraph
    if (inList) { out.push('</ul>'); inList = false }
    out.push(`<p class="mb-2">${inline(line)}</p>`)
  }

  if (inList) out.push('</ul>')
  return out.join('')
}

function inline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline" style="color:var(--accent)">$1</a>')
}
