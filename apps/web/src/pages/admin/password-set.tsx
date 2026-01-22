import { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'
import { useAdminAuth } from '@/hooks/use-admin-auth'

export function AdminPasswordSetPage() {
  const api = useMemo(() => createApiClient(), [])
  const [location, setLocation] = useLocation()
  const { isAuthenticated, isReady } = useAdminAuth()

  const [, paramsPrimary] = useRoute('/axis/password-set/:token?')
  const [, paramsAuth] = useRoute('/axis/auth/password-set/:token?')

  const token = useMemo(() => {
    const tokenFromQuery = new URLSearchParams(window.location.search).get('token')
    const tokenFromPath = paramsPrimary?.token ?? paramsAuth?.token
    return tokenFromQuery ?? tokenFromPath ?? ''
  }, [location, paramsAuth?.token, paramsPrimary?.token])

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!isReady) return
    if (!isAuthenticated) return
    setLocation('/axis/dashboard')
  }, [isAuthenticated, isReady, setLocation])

  const validate = () => {
    const next: Record<string, string> = {}

    if (!token) next.token = 'This link is missing a reset token'

    if (!formData.password) next.password = 'New password is required'
    else if (formData.password.length < 8) next.password = 'Password must be at least 8 characters'

    if (!formData.confirmPassword) next.confirmPassword = 'Please confirm your new password'
    else if (formData.password && formData.password !== formData.confirmPassword) next.confirmPassword = 'Passwords do not match'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      if (!token) toast.error('Invalid reset link', { description: 'Please request a new password reset link.' })
      return
    }

    setIsLoading(true)
    try {
      // Backend currently exposes a single password-set endpoint.
      // Admins reach this page under /axis/*, but the API call is the same.
      await api.post(endpoints.auth.passwordSet, { token, newPassword: formData.password })

      setIsSuccess(true)
      toast.success('Password updated', { description: 'You can now sign in to the admin portal.' })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update password.'
      toast.error('Update failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const onChange = (field: 'password' | 'confirmPassword', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Password Updated</CardTitle>
            <CardDescription>Your admin password has been changed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">You can now sign in using your new password.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation('/axis/login')}>Go to Admin Sign In</Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation('/')}>Back to Store</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Set Admin Password</CardTitle>
          <CardDescription>Create a new password for your admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {errors.token ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm">{errors.token}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => onChange('password', e.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
              />
              {errors.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => onChange('confirmPassword', e.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
              />
              {errors.confirmPassword ? <p className="text-sm text-destructive">{errors.confirmPassword}</p> : null}
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Use at least 8 characters. Avoid reusing old passwords.</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              Update Password
            </Button>

            <Button type="button" variant="outline" className="w-full" onClick={() => setLocation('/axis/login')}>
              Back to Admin Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
