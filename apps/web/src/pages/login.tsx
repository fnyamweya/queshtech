import { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { AuthCard } from '@/components/auth/auth-card'
import { BoldButton } from '@/components/auth/bold-button'
import { BoldInput } from '@/components/auth/bold-input'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { ArrowRight } from '@phosphor-icons/react'

export function LoginPage() {
  const [location, setLocation] = useLocation()
  const { login, loginWithGoogle, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rememberMe, setRememberMe] = useState(false)

  const redirectPath = useMemo(() => {
    const query = location.split('?')[1]
    if (!query) return null

    const raw = new URLSearchParams(query).get('redirect')
    if (!raw) return null

    let decoded = raw
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      // ignore
    }

    // Prevent open redirects. Only allow internal absolute paths.
    if (!decoded.startsWith('/')) return null
    if (decoded.startsWith('//')) return null
    if (decoded.includes('://')) return null

    return decoded
  }, [location])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.identifier.trim()) {
      newErrors.identifier = 'Email or phone is required'
    } else {
      const value = formData.identifier.trim()
      const isEmail = value.includes('@')
      const isPhone = /^\+?[0-9]{10,13}$/.test(value.replace(/\s/g, ''))

      if (!isEmail && !isPhone) {
        newErrors.identifier = 'Enter a valid email or phone number'
      }
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const result = await login({
      identifier: formData.identifier,
      password: formData.password,
    })

    if (result.success) {
      toast.success('Welcome back!', {
        description: 'You have successfully signed in',
      })
      setLocation(redirectPath || '/')
    } else {
      toast.error('Login failed', {
        description: result.error || 'Please check your credentials',
      })
    }
  }

  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle()

    if (result.success) {
      // OAuth initiation triggers a full-page redirect to the backend.
      // The final redirect is handled by /oauth/google/callback after exchange.
      toast.success('Continuing with Google…')
    } else {
      toast.error('Google sign in failed', {
        description: result.error || 'Please try again',
      })
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <AuthCard
        title="Welcome Back"
        description="Sign in to your QueshTech account"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <BoldInput
            label="Email or Phone"
            type="text"
            required
            value={formData.identifier}
            onChange={(e) => handleChange('identifier', e.target.value)}
            error={errors.identifier}
            placeholder="+254712345678 or jane.doe@example.com"
          />

          <BoldInput
            label="Password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
            placeholder="••••••••"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 border-2 border-input bg-background cursor-pointer"
                style={{ borderRadius: 0 }}
              />
              <span className="text-sm text-foreground">Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => setLocation('/forgot-password')}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <BoldButton
              type="submit"
              variant="primary"
              isLoading={isLoading}
              icon={<ArrowRight size={20} weight="bold" />}
            >
              Sign In
            </BoldButton>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-semibold tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            <BoldButton
              type="button"
              variant="google"
              onClick={handleGoogleLogin}
              isLoading={isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </BoldButton>
          </div>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button
              type="button"
              onClick={() => setLocation('/signup')}
              className="text-primary font-semibold hover:underline"
            >
              Sign up
            </button>
          </div>
        </form>
      </AuthCard>
    </div>
  )
}
