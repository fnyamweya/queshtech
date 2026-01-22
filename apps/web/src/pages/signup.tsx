import { useState } from 'react'
import { useLocation } from 'wouter'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthNotice } from '@/components/auth/auth-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { ArrowRight } from '@phosphor-icons/react'

export function SignupPage() {
  const [, setLocation] = useLocation()
  const { signup, loginWithGoogle, isLoading } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required'
    } else if (!/^\+?[0-9]{10,13}$/.test(formData.phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = 'Enter a valid phone number'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    const result = await signup({
      firstName: formData.firstName,
      lastName: formData.lastName,
      phoneNumber: formData.phoneNumber,
      email: formData.email || undefined,
      password: formData.password,
    })

    if (result.success) {
      toast.success('Account created successfully!', {
        description: 'Welcome to QueshTech',
      })
      setLocation('/')
    } else {
      toast.error('Signup failed', {
        description: result.error || 'Please try again',
      })
    }
  }

  const handleGoogleLogin = async () => {
    const result = await loginWithGoogle()

    if (result.success) {
      toast.success('Signed in with Google!', {
        description: 'Welcome to QueshTech',
      })
      setLocation('/')
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
      title="Create your account"
      description="A few details and you’re ready to go."
      headerRight={
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLocation('/login')}>
          Sign in
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="John"
              autoComplete="given-name"
              aria-invalid={Boolean(errors.firstName) || undefined}
            />
            {errors.firstName ? <p className="text-sm font-medium text-destructive">{errors.firstName}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Doe"
              autoComplete="family-name"
              aria-invalid={Boolean(errors.lastName) || undefined}
            />
            {errors.lastName ? <p className="text-sm font-medium text-destructive">{errors.lastName}</p> : null}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            required
            value={formData.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            placeholder="+254712345678"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phoneNumber) || undefined}
          />
          {errors.phoneNumber ? <p className="text-sm font-medium text-destructive">{errors.phoneNumber}</p> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="john@example.com"
            autoComplete="email"
            aria-invalid={Boolean(errors.email) || undefined}
          />
          {errors.email ? <p className="text-sm font-medium text-destructive">{errors.email}</p> : null}
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
          {errors.confirmPassword ? <p className="text-sm font-medium text-destructive">{errors.confirmPassword}</p> : null}
        </div>

        <AuthNotice className="text-sm text-muted-foreground">
          Use at least <span className="font-semibold text-foreground">8 characters</span>. For best security, avoid reusing old passwords.
        </AuthNotice>

        <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
          Create account
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
          Already have an account?{' '}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLocation('/login')}>
            Sign in
          </Button>
        </p>
      </form>
    </AuthShell>
  )
}
