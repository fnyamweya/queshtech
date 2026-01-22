import { useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { AuthShell } from '@/components/auth/auth-shell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
    <AuthShell
      title="Welcome back"
      description="Sign in to continue shopping."
      headerRight={
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLocation('/signup')}>
          Create account
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="identifier">Email or phone</Label>
          <Input
            id="identifier"
            type="text"
            required
            value={formData.identifier}
            onChange={(e) => handleChange('identifier', e.target.value)}
            placeholder="+254712345678 or jane.doe@example.com"
            autoComplete="username"
            aria-invalid={Boolean(errors.identifier) || undefined}
          />
          {errors.identifier ? <p className="text-sm font-medium text-destructive">{errors.identifier}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password) || undefined}
          />
          {errors.password ? <p className="text-sm font-medium text-destructive">{errors.password}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
            />
            Remember me
          </label>

          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setLocation('/forgot-password')}
          >
            Forgot password?
          </Button>
        </div>

        <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
          Sign in
          <ArrowRight size={16} weight="bold" />
        </Button>

        <div className="relative py-1">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs font-semibold text-muted-foreground">
            Or continue with
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-3"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLocation('/signup')}>
            Sign up
          </Button>
        </p>
      </form>
    </AuthShell>
  )
}
