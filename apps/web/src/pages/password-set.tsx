import { useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthNotice } from '@/components/auth/auth-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { ApiError } from '@/lib/api'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'

export function PasswordSetPage() {
  const api = useMemo(() => createApiClient(), [])
  const [location, setLocation] = useLocation()
  const [, paramsPrimary] = useRoute('/password-set/:token?')
  const [, paramsAuth] = useRoute('/auth/password-set/:token?')

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
  const [isSuccess, setIsSuccess] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!token) {
      newErrors.token = 'This link is missing a reset token'
    }

    if (!formData.password) {
      newErrors.password = 'New password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password'
    } else if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      if (!token) {
        toast.error('Invalid reset link', {
          description: 'Please request a new password reset link.',
        })
      }
      return
    }

    setIsLoading(true)
    try {
      await api.post(endpoints.auth.passwordSet, {
        token,
        newPassword: formData.password,
      })

      setIsSuccess(true)
      toast.success('Password updated', {
        description: 'You can now sign in with your new password.',
      })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update password.'
      toast.error('Update failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: 'password' | 'confirmPassword', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  if (isSuccess) {
    return (
      <AuthShell title="Password updated" description="Your password has been changed successfully.">
        <div className="grid gap-5">
          <AuthNotice tone="primary">
            You can now sign in using your new password.
          </AuthNotice>

          <div className="grid gap-3">
            <Button className="h-11 w-full gap-2" onClick={() => setLocation('/login')}>
              Go to sign in
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

  return (
    <AuthShell title="Set a new password" description="Create a new password for your account.">
      <form onSubmit={handleSubmit} className="grid gap-5">
        {errors.token ? (
          <AuthNotice tone="destructive">
            <span className="font-semibold text-destructive">{errors.token}</span>
          </AuthNotice>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
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
          <Label htmlFor="confirmPassword">Confirm new password</Label>
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

        <AuthNotice className="text-muted-foreground">
          Use at least <span className="font-semibold text-foreground">8 characters</span>. For best security, avoid reusing old passwords.
        </AuthNotice>

        <div className="grid gap-3">
          <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
            Update password
            <ArrowRight size={16} weight="bold" />
          </Button>

          <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={() => setLocation('/forgot-password')}>
            <ArrowLeft size={16} weight="bold" />
            Back
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
