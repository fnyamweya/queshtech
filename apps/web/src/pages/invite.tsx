import { useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { AuthCard } from '@/components/auth/auth-card'
import { BoldButton } from '@/components/auth/bold-button'
import { BoldInput } from '@/components/auth/bold-input'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { ApiError } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

export function InvitePage() {
  const api = useMemo(() => createApiClient(), [])
  const [location, setLocation] = useLocation()
  const [, paramsPrimary] = useRoute('/invite/:token?')
  const [, paramsAuth] = useRoute('/auth/invite/:token?')

  const token = useMemo(() => {
    const tokenFromQuery = new URLSearchParams(window.location.search).get('token')
    const tokenFromPath = paramsPrimary?.token ?? paramsAuth?.token
    return tokenFromQuery ?? tokenFromPath ?? ''
  }, [location, paramsPrimary?.token, paramsAuth?.token])

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'accepted' | 'declined'>('idle')

  const validate = () => {
    const next: Record<string, string> = {}

    if (!token) next.token = 'This link is missing an invitation token'

    if (!formData.password) next.password = 'Password is required'
    else if (formData.password.length < 8) next.password = 'Password must be at least 8 characters'

    if (!formData.confirmPassword) next.confirmPassword = 'Please confirm your password'
    else if (formData.password !== formData.confirmPassword) next.confirmPassword = 'Passwords do not match'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const acceptInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      if (!token) {
        toast.error('Invalid invitation link', { description: 'Please request a new invitation.' })
      }
      return
    }

    setIsLoading(true)
    try {
      await api.post(endpoints.auth.inviteAccept, { token, password: formData.password })

      setStatus('accepted')
      toast.success('Invitation accepted', { description: 'Your account has been activated.' })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to accept invitation.'
      toast.error('Accept failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const declineInvite = async () => {
    if (!token) {
      setErrors({ token: 'This link is missing an invitation token' })
      toast.error('Invalid invitation link', { description: 'Please request a new invitation.' })
      return
    }

    setIsLoading(true)
    try {
      await api.post(endpoints.auth.inviteDecline, { token })

      setStatus('declined')
      toast.success('Invitation declined')
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to decline invitation.'
      toast.error('Decline failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: 'password' | 'confirmPassword', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <AuthCard title="Account Activated" description="Your invitation has been accepted">
          <div className="space-y-6">
            <div className="bg-primary/10 border-2 border-primary/20 p-6" style={{ borderRadius: 0 }}>
              <p className="text-sm text-foreground leading-relaxed">
                Your account is ready. You can now sign in.
              </p>
            </div>

            <div className="space-y-3">
              <BoldButton
                variant="primary"
                onClick={() => setLocation('/axis/login')}
                icon={<ArrowRight size={20} weight="bold" />}
              >
                Go to Admin Sign In
              </BoldButton>

              <BoldButton variant="outline" onClick={() => setLocation('/')}>Back to Home</BoldButton>
            </div>
          </div>
        </AuthCard>
      </div>
    )
  }

  if (status === 'declined') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <AuthCard title="Invitation Declined" description="This invitation is no longer usable">
          <div className="space-y-6">
            <div className="bg-muted/50 border-2 border-border p-6" style={{ borderRadius: 0 }}>
              <p className="text-sm text-foreground leading-relaxed">
                If this was a mistake, please ask the admin to send a new invitation.
              </p>
            </div>

            <div className="space-y-3">
              <BoldButton
                variant="primary"
                onClick={() => setLocation('/')}
                icon={<ArrowRight size={20} weight="bold" />}
              >
                Back to Home
              </BoldButton>
            </div>
          </div>
        </AuthCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <AuthCard title="You're Invited" description="Set a password to activate your account">
        <form onSubmit={acceptInvite} className="space-y-5">
          {errors.token && (
            <div className="bg-destructive/10 border-2 border-destructive/20 p-4" style={{ borderRadius: 0 }}>
              <p className="text-sm text-foreground">{errors.token}</p>
            </div>
          )}

          <BoldInput
            label="Password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <BoldInput
            label="Confirm Password"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <div className="space-y-3 pt-2">
            <BoldButton
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<ArrowRight size={20} weight="bold" />}
            >
              Accept Invitation
            </BoldButton>

            <BoldButton
              type="button"
              variant="outline"
              onClick={declineInvite}
              isLoading={isLoading}
            >
              Decline Invitation
            </BoldButton>

            <BoldButton type="button" variant="outline" onClick={() => setLocation('/')}
            >
              <ArrowLeft size={20} weight="bold" />
              Back
            </BoldButton>
          </div>
        </form>
      </AuthCard>
    </div>
  )
}
