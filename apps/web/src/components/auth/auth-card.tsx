import { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface AuthCardProps {
  children: ReactNode
  title: string
  description?: string
}

export function AuthCard({ children, title, description }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border-2 border-border shadow-2xl" style={{ borderRadius: 0 }}>
      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </Card>
  )
}
