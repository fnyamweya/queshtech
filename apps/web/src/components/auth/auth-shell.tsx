import type { ReactNode } from 'react'
import { Link } from 'wouter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowUUpLeft, LockKey, ShieldCheck, Truck } from '@phosphor-icons/react'

interface AuthShellProps {
  title: string
  description?: string
  children: ReactNode
  headerRight?: ReactNode
  className?: string
}

const perks = [
  {
    icon: Truck,
    title: 'Fast delivery',
    description: 'Same‑day Nairobi • Nationwide shipping',
  },
  {
    icon: ShieldCheck,
    title: 'Secure payments',
    description: 'M‑Pesa, cards, and wallets',
  },
  {
    icon: ArrowUUpLeft,
    title: 'Easy returns',
    description: '30‑day return window',
  },
]

export function AuthShell({ title, description, children, headerRight, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        'min-h-dvh',
        'bg-[radial-gradient(900px_circle_at_20%_-10%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent_60%),radial-gradient(900px_circle_at_90%_0%,color-mix(in_oklab,var(--color-accent)_14%,transparent),transparent_55%)]',
        'bg-background'
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-10 lg:py-16">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="hidden lg:flex flex-col gap-10">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <span className="font-black text-lg">Q</span>
              </div>
              <div className="leading-tight">
                <div className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  QueshTech
                </div>
                <div className="text-sm text-muted-foreground">Shop smart. Ship fast.</div>
              </div>
            </Link>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                <LockKey size={14} weight="bold" className="text-primary" />
                Secure sign in • Fast checkout
              </div>
              <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                A smoother way to shop for tech.
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-[46ch]">
                Sign in to save items, track orders, and enjoy a faster checkout experience across devices.
              </p>
            </div>

            <div className="grid gap-4">
              {perks.map((perk) => {
                const Icon = perk.icon
                return (
                  <div key={perk.title} className="flex items-start gap-3">
                    <div className="mt-0.5 size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
                      <Icon size={16} weight="bold" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{perk.title}</div>
                      <div className="text-sm text-muted-foreground">{perk.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-6">
            <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
              <div className="size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <span className="font-black">Q</span>
              </div>
              <div className="text-base font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                QueshTech
              </div>
            </Link>

            <Card className={cn('w-full max-w-md shadow-xl shadow-black/5 dark:shadow-black/25', className)}>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                      {title}
                    </CardTitle>
                    {description ? <CardDescription>{description}</CardDescription> : null}
                  </div>
                  {headerRight ? <div className="pt-0.5">{headerRight}</div> : null}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {children}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

