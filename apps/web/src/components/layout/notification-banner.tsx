import { useState, useEffect } from 'react'
import { X, Lightning, Truck, Sparkle } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useStorage } from '@/hooks/use-storage'
import { motion, AnimatePresence } from 'framer-motion'

interface NotificationBannerProps {
  id: string
  message: string
  action?: {
    label: string
    href: string
  }
  type?: 'info' | 'success' | 'warning' | 'promo'
  dismissible?: boolean
}

export function NotificationBanner({
  id,
  message,
  action,
  type = 'info',
  dismissible = true,
}: NotificationBannerProps) {
  const [dismissed, setDismissed] = useStorage<string[]>('dismissed-banners', [])
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    setIsVisible(!(dismissed || []).includes(id))
  }, [dismissed, id])

  const handleDismiss = () => {
    setIsVisible(false)
    setDismissed((current) => [...(current || []), id])
  }

  const getIcon = () => {
    switch (type) {
      case 'promo':
        return <Sparkle size={16} weight="fill" />
      case 'success':
        return <Lightning size={16} weight="fill" />
      case 'warning':
        return <Truck size={16} weight="fill" />
      default:
        return <Lightning size={16} />
    }
  }

  const getStyles = () => {
    switch (type) {
      case 'promo':
        return 'bg-gradient-to-r from-primary/10 via-accent/10 to-cyber-cyan/10 border-primary/20'
      case 'success':
        return 'bg-gradient-to-r from-success/10 to-success/5 border-success/20'
      case 'warning':
        return 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20'
      default:
        return 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20'
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Alert className={`relative rounded-none border-x-0 ${getStyles()}`}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-primary flex-shrink-0">{getIcon()}</span>
                  <AlertDescription className="text-sm font-medium truncate">
                    {message}
                  </AlertDescription>
                  {action && (
                    <a
                      href={action.href}
                      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap hidden sm:inline"
                    >
                      {action.label} →
                    </a>
                  )}
                </div>
                {dismissible && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-6 w-6 p-0 hover:bg-background/50 flex-shrink-0"
                  >
                    <X size={14} />
                    <span className="sr-only">Dismiss</span>
                  </Button>
                )}
              </div>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
