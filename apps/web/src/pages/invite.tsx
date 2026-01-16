import { useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthNotice, AuthSpinner } from '@/components/auth/auth-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <AuthShell title="Account activated" description="Your invitation has been accepted.">
        <div className="grid gap-5">
          <AuthNotice tone="primary">
            Your account is ready. You can now sign in.
          </AuthNotice>

          <div className="grid gap-3">
            <Button className="h-11 w-full gap-2" onClick={() => setLocation('/axis/login')}>
              Go to admin sign in
              <ArrowRight size={16} weight="bold" />
            </Button>
            <Button variant="outline" className="h-11 w-full" onClick={() => setLocation('/')}>
              Back to home
            </Button>
          </div>
        </div>
      </AuthShell>
    )
  }

  if (status === 'declined') {
    return (
      <AuthShell title="Invitation declined" description="This invitation is no longer usable.">
        <div className="grid gap-5">
          <AuthNotice className="text-muted-foreground">
            If this was a mistake, please ask the admin to send a new invitation.
          </AuthNotice>

          <Button className="h-11 w-full gap-2" onClick={() => setLocation('/')}>
            Back to home
            <ArrowRight size={16} weight="bold" />
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="You’re invited" description="Set a password to activate your account.">
      <form onSubmit={acceptInvite} className="grid gap-5">
        {errors.token ? (
          <AuthNotice tone="destructive">
            <span className="font-semibold text-destructive">{errors.token}</span>
          </AuthNotice>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password) || undefined}
          />
          {errors.password ? <p className="text-sm font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword) || undefined}
          />
          {errors.confirmPassword ? (
            <p className="text-sm font-medium text-destructive">{errors.confirmPassword}</p>
          ) : null}
        </div>

        <div className="grid gap-3">
          <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
            {isLoading ? <AuthSpinner /> : null}
            Accept invitation
            <ArrowRight size={16} weight="bold" />
          </Button>

          <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={declineInvite} disabled={isLoading}>
            {isLoading ? <AuthSpinner /> : null}
            Decline invitation
          </Button>

          <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={() => setLocation('/')} disabled={isLoading}>
            <ArrowLeft size={16} weight="bold" />
            Back
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
