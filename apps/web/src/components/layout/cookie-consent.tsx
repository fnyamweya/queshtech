import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Cookie, X, Gear, ShieldCheck } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useStorage } from '@/hooks/use-storage'

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
  personalization: boolean
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useStorage<CookiePreferences>('cookie-preferences', {
    essential: true,
    analytics: false,
    marketing: false,
    personalization: false,
  })
  const [hasConsented, setHasConsented] = useStorage<boolean>('cookie-consent', false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasConsented) {
        setIsVisible(true)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [hasConsented])

  const handleAcceptAll = () => {
    setPreferences((current) => ({
      essential: true,
      analytics: true,
      marketing: true,
      personalization: true,
    }))
    setHasConsented((current) => true)
    setIsVisible(false)
  }

  const handleAcceptSelected = () => {
    setHasConsented((current) => true)
    setIsVisible(false)
  }

  const handleRejectAll = () => {
    setPreferences((current) => ({
      essential: true,
      analytics: false,
      marketing: false,
      personalization: false,
    }))
    setHasConsented((current) => true)
    setIsVisible(false)
  }

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    setPreferences((current) => ({
      ...(current || { essential: true, analytics: false, marketing: false, personalization: false }),
      [key]: value,
    }))
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            onClick={() => {}}
          />
          
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[101]"
          >
            <Card className="relative p-6 shadow-2xl border-2">
              <button
                onClick={handleRejectAll}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={14} weight="bold" />
              </button>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Cookie size={20} weight="bold" className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">We Value Your Privacy</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                    </p>
                  </div>
                </div>

                <AnimatePresence>
                  {showDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <Separator />
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={16} weight="bold" className="text-primary" />
                            <div>
                              <Label className="text-sm font-semibold">Essential</Label>
                              <p className="text-xs text-muted-foreground">Required for site functionality</p>
                            </div>
                          </div>
                          <Switch checked={true} disabled />
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <Label htmlFor="analytics" className="text-sm font-semibold cursor-pointer">Analytics</Label>
                            <p className="text-xs text-muted-foreground">Help us improve your experience</p>
                          </div>
                          <Switch
                            id="analytics"
                            checked={preferences?.analytics ?? false}
                            onCheckedChange={(checked) => updatePreference('analytics', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <Label htmlFor="marketing" className="text-sm font-semibold cursor-pointer">Marketing</Label>
                            <p className="text-xs text-muted-foreground">Personalized offers and ads</p>
                          </div>
                          <Switch
                            id="marketing"
                            checked={preferences?.marketing ?? false}
                            onCheckedChange={(checked) => updatePreference('marketing', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between py-2">
                          <div>
                            <Label htmlFor="personalization" className="text-sm font-semibold cursor-pointer">Personalization</Label>
                            <p className="text-xs text-muted-foreground">Tailored content for you</p>
                          </div>
                          <Switch
                            id="personalization"
                            checked={preferences?.personalization ?? false}
                            onCheckedChange={(checked) => updatePreference('personalization', checked)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-2 pt-2">
                  {showDetails ? (
                    <>
                      <Button onClick={handleAcceptSelected} size="sm" className="w-full">
                        Save Preferences
                      </Button>
                      <Button
                        onClick={() => setShowDetails(false)}
                        variant="ghost"
                        size="sm"
                        className="w-full"
                      >
                        Back
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleAcceptAll} size="sm" className="w-full">
                        Accept All
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => setShowDetails(true)}
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                        >
                          <Gear size={14} weight="bold" />
                          Customize
                        </Button>
                        <Button
                          onClick={handleRejectAll}
                          variant="ghost"
                          size="sm"
                        >
                          Reject All
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  By continuing, you agree to our{' '}
                  <a href="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
