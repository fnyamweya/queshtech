import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowRight } from '@phosphor-icons/react'

export function NewsletterCard() {
  const [email, setEmail] = useState('')

  return (
    <Card className="relative overflow-hidden border-border bg-gradient-to-br from-background via-background/80 to-muted">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[640px] -translate-x-1/2 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-primary)_22%,transparent),transparent)] opacity-60" />
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Stay ahead</p>
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Weekly drops, deals, and restocks.
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Get product launches, limited-time discounts, and curated picks tailored to how you shop.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmed = email.trim()
            if (!trimmed) return
            toast.success('You’re subscribed.', { description: 'Watch your inbox for the next drop.' })
            setEmail('')
          }}
        >
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email address"
            autoComplete="email"
            className="h-11"
          />
          <Button type="submit" className="h-11 gap-2 shadow-sm">
            Subscribe
            <ArrowRight size={16} weight="bold" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
