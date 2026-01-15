import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeSlash, Lock, User } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function AdminLoginPage() {
  const [location, setLocation] = useLocation()
  const { login, loginWithGoogle, isLoading, isAuthenticated, isReady } = useAdminAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: '',
  })

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

    // Prevent open redirects. Only allow internal admin absolute paths.
    if (!decoded.startsWith('/axis')) return null
    if (decoded.startsWith('//')) return null
    if (decoded.includes('://')) return null
    if (decoded.startsWith('/axis/login')) return null

    return decoded
  }, [location])

  useEffect(() => {
    if (!isReady) return
    if (!isAuthenticated) return
    setLocation(redirectPath || '/axis/dashboard')
  }, [isAuthenticated, isReady, setLocation])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = await login({
      email: formData.email,
      password: formData.password,
      twoFactorCode: formData.twoFactorCode || undefined,
    })

    if (result.success) {
      toast.success('Welcome back!', { description: 'Signed in successfully.' })
      setLocation(redirectPath || '/axis/dashboard')
    } else {
      toast.error('Sign in failed', { description: result.error || 'Please check your credentials.' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" weight="duotone" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
          <CardDescription>
            Enter your credentials to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeSlash className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twoFactorCode">Two-factor code (optional)</Label>
              <Input
                id="twoFactorCode"
                type="text"
                placeholder="123456"
                value={formData.twoFactorCode}
                onChange={(e) => setFormData({ ...formData, twoFactorCode: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => loginWithGoogle('axis')}
              disabled={isLoading}
            >
              Continue with Google
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>Demo credentials: admin@example.com / AdminP@ss123</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
