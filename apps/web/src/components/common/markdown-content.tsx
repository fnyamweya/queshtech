import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function MarkdownContent(props: { markdown?: string | null; className?: string }) {
  const markdown = String(props.markdown ?? '')
  const [html, setHtml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const text = markdown.trim()
    if (!text) {
      setHtml('')
      return
    }

    setIsLoading(true)
    ;(async () => {
      const [{ marked }, { default: DOMPurify }] = await Promise.all([import('marked'), import('dompurify')])
      const raw = marked.parse(text)
      const safe = DOMPurify.sanitize(String(raw))
      if (!cancelled) setHtml(safe)
    })()
      .catch(() => {
        if (!cancelled) setHtml('')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [markdown])

  if (!markdown.trim()) return null

  if (isLoading && !html) {
    return <div className={cn('text-sm text-muted-foreground', props.className)}>{markdown}</div>
  }

  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-muted-foreground',
        '[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline',
        '[&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_p]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        props.className
      )}
      dangerouslySetInnerHTML={{ __html: html || markdown }}
    />
  )
}

