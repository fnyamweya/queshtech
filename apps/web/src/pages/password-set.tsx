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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
        <AuthCard title="Password Updated" description="Your password has been changed successfully">
          <div className="space-y-6">
            <div className="bg-primary/10 border-2 border-primary/20 p-6" style={{ borderRadius: 0 }}>
              <p className="text-sm text-foreground leading-relaxed">
                Your password has been updated. You can now sign in using your new password.
              </p>
            </div>

            <div className="space-y-3">
              <BoldButton
                variant="primary"
                onClick={() => setLocation('/login')}
                icon={<ArrowRight size={20} weight="bold" />}
              >
                Go to Sign In
              </BoldButton>

              <BoldButton type="button" variant="outline" onClick={() => setLocation('/')}
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
      <AuthCard title="Set New Password" description="Create a new password for your account">
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.token && (
            <div className="bg-destructive/10 border-2 border-destructive/20 p-4" style={{ borderRadius: 0 }}>
              <p className="text-sm text-foreground">{errors.token}</p>
            </div>
          )}

          <BoldInput
            label="New Password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <BoldInput
            label="Confirm New Password"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            placeholder="••••••••"
            autoComplete="new-password"
          />

          <div className="bg-muted/50 border-2 border-border p-4" style={{ borderRadius: 0 }}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use at least 8 characters. For best security, avoid reusing old passwords.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <BoldButton
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<ArrowRight size={20} weight="bold" />}
            >
              Update Password
            </BoldButton>

            <BoldButton type="button" variant="outline" onClick={() => setLocation('/forgot-password')}>
              <ArrowLeft size={20} weight="bold" />
              Back
            </BoldButton>
          </div>
        </form>
      </AuthCard>
    </div>
  )
}
