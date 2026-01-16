import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AuthCardProps {
  children: ReactNode
  title: string
  description?: string
}

export function AuthCard({ children, title, description }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md shadow-xl shadow-black/5 dark:shadow-black/25">
      <CardHeader className="border-b">
        <CardTitle className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-6">
        {children}
      </CardContent>
    </Card>
  )
}
