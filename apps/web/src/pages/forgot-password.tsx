import { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { AuthShell } from '@/components/auth/auth-shell'
import { AuthNotice } from '@/components/auth/auth-helpers'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ArrowRight, ArrowLeft } from '@phosphor-icons/react'
import { ApiError } from '@/lib/api'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { endpoints } from '@/lib/endpoints'
import { createApiClient } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function isEmailIdentifier(value: string) {
  return value.includes('@')
}

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, '')
}

function extractResetToken(payload: unknown): string | null {
  const directCandidates = [
    (payload as any)?.resetToken,
    (payload as any)?.reset_token,
    (payload as any)?.token,
    (payload as any)?.data?.resetToken,
    (payload as any)?.data?.reset_token,
    (payload as any)?.data?.token,
  ]

  const direct = directCandidates.find((v) => typeof v === 'string' && v.length > 0)
  return typeof direct === 'string' ? direct : null
}

type Step = 'send' | 'verify' | 'reset' | 'done'

function stepFromParam(value: unknown): Step {
  const v = String(value || '').toLowerCase().trim()
  if (v === 'verify' || v === 'reset' || v === 'done' || v === 'send') return v
  return 'send'
}

function pathForStep(step: Step) {
  return `/forgot-password/${step}`
}

function maskIdentifier(raw: string) {
  const value = raw.trim()
  if (!value) return ''

  if (value.includes('@')) {
    const [user, domain] = value.split('@')
    const safeUser = user.length <= 2 ? `${user[0] || ''}*` : `${user.slice(0, 2)}***`
    return `${safeUser}@${domain}`
  }

  const phone = value.replace(/\s+/g, '')
  if (phone.length <= 4) return `***${phone}`
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`
}

export function ForgotPasswordPage() {
  const api = useMemo(() => createApiClient(), [])
  const [location, setLocation] = useLocation()
  const [, params] = useRoute('/forgot-password/:step?')
  const step = useMemo<Step>(() => stepFromParam(params?.step), [params?.step])

  const [identifier, setIdentifier] = useState('')
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const canVerify = useMemo(() => Boolean(userId.trim() && code.trim().length === 6), [userId, code])

  // Ensure the URL always reflects the current step.
  useEffect(() => {
    const base = location.split('?')[0]
    if (base === '/forgot-password') {
      setLocation(pathForStep('send'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  // Guard deep-links: verify requires userId; reset requires resetToken.
  useEffect(() => {
    if (step === 'verify' && !userId) {
      // If user reloads /verify without state, bring them back.
      setLocation(pathForStep('send'))
    }
    if (step === 'reset' && !resetToken) {
      setLocation(pathForStep('verify'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const validateSend = () => {
    const next: Record<string, string> = {}
    const value = identifier.trim()
    if (!value) next.identifier = 'Email or phone is required'
    else {
      const isEmail = isEmailIdentifier(value)
      const phone = normalizePhone(value)
      const isPhone = /^\+?[0-9]{10,13}$/.test(phone)
      if (!isEmail && !isPhone) next.identifier = 'Enter a valid email or phone number'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const validateVerify = () => {
    const next: Record<string, string> = {}
    if (!identifier.trim()) next.identifier = 'Email or phone is required'
    if (!userId.trim()) next.userId = 'User ID is required'
    if (!code.trim()) next.code = 'Verification code is required'
    else if (code.trim().length !== 6) next.code = 'Enter the 6-digit code'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const validateReset = () => {
    const next: Record<string, string> = {}
    if (!newPassword) next.newPassword = 'New password is required'
    else if (newPassword.length < 6) next.newPassword = 'Password must be at least 6 characters'
    if (!confirmPassword) next.confirmPassword = 'Confirm password is required'
    else if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match'
    if (!resetToken) next.resetToken = 'Missing reset token; verify the code again.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateSend()) return

    setIsLoading(true)
    try {
      const value = identifier.trim()

      // Verified in Swagger: POST /api/v1/auth/otp/send/forgot-password
      // Strict DTO: { identifier }
      const payload = await api.post<any>(endpoints.auth.otpSendForgotPassword, { identifier: value })

      const nextUserId = String((payload as any)?.userId || (payload as any)?.data?.userId || '').trim()
      if (!nextUserId) {
        toast.error('Request failed', {
          description: 'Server did not return a userId for OTP verification. Please contact support.',
        })
        return
      }

      setUserId(nextUserId)

      setLocation(pathForStep('verify'))
      toast.success('Verification code sent', {
        description: 'Check your messages for the OTP code.',
      })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to send verification code.'
      toast.error('Request failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateVerify()) return

    setIsLoading(true)
    try {
      // Verified in Swagger: POST /api/v1/auth/otp/verify/forgot-password
      // Strict DTO: { userId, code }
      const payload = await api.post<any>(endpoints.auth.otpVerifyForgotPassword, {
        userId: userId.trim(),
        code: code.trim(),
      })

      const token = extractResetToken(payload)
      if (!token) {
        toast.error('Verification failed', {
          description: 'Server did not return a reset token. Please try again.',
        })
        return
      }

      setResetToken(token)
      setLocation(pathForStep('reset'))
      toast.success('Code verified', { description: 'You can now set a new password.' })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Invalid or expired verification code.'
      toast.error('Verification failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateReset()) return

    setIsLoading(true)
    try {
      // Verified in Swagger: POST /api/v1/auth/reset-password
      // Strict DTO: { resetToken, newPassword }
      await api.post(endpoints.auth.resetPassword, { resetToken, newPassword })

      setLocation(pathForStep('done'))
      toast.success('Password reset', { description: 'You can now sign in with your new password.' })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to reset password.'
      toast.error('Reset failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <AuthShell title="Password updated" description="You can now sign in with your new password.">
        <div className="grid gap-5">
          <AuthNotice tone="primary">
            Your password has been reset for <span className="font-semibold">{identifier}</span>.
          </AuthNotice>
          <Button className="h-11 w-full gap-2" onClick={() => setLocation('/login')}>
            Back to sign in
            <ArrowRight size={16} weight="bold" />
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset password"
      description={
        step === 'send'
          ? 'Step 1 of 3 — Request a verification code'
          : step === 'verify'
            ? 'Step 2 of 3 — Verify the code'
            : 'Step 3 of 3 — Set a new password'
      }
      headerRight={
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLocation('/login')}>
          Sign in
        </Button>
      }
    >
      {step === 'send' && (
        <form onSubmit={handleSend} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="identifier">Email or phone</Label>
            <Input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value)
                if (userId) setUserId('')
                if (resetToken) setResetToken(null)
                if (errors.identifier) setErrors(prev => ({ ...prev, identifier: '' }))
              }}
              placeholder="+254712345678 or jane.doe@example.com"
              autoComplete="username"
              aria-invalid={Boolean(errors.identifier) || undefined}
            />
            {errors.identifier ? <p className="text-sm font-medium text-destructive">{errors.identifier}</p> : null}
          </div>

          <AuthNotice className="text-muted-foreground">
            We’ll send a 6‑digit code to confirm it’s you.
          </AuthNotice>

          <div className="grid gap-3">
            <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
              Send verification code
              <ArrowRight size={16} weight="bold" />
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={() => setLocation('/login')}>
              <ArrowLeft size={16} weight="bold" />
              Back to sign in
            </Button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="grid gap-5">
          <AuthNotice className="text-muted-foreground">
            We sent a 6‑digit code to <span className="font-semibold text-foreground">{maskIdentifier(identifier)}</span>.
          </AuthNotice>

          <div className="grid gap-3">
            <Label className="justify-center">Verification code</Label>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value)
                if (errors.code) setErrors(prev => ({ ...prev, code: '' }))
              }}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {errors.code ? <p className="text-center text-sm font-medium text-destructive">{errors.code}</p> : null}
          </div>

          <div className="grid gap-3">
            <Button type="submit" className="h-11 w-full gap-2" disabled={!canVerify || isLoading}>
              Verify code
              <ArrowRight size={16} weight="bold" />
            </Button>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2"
                disabled={isLoading}
                onClick={() => {
                  setCode('')
                  setErrors({})
                  setUserId('')
                  setLocation(pathForStep('send'))
                }}
              >
                <ArrowLeft size={16} weight="bold" />
                Change email/phone
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2"
                disabled={isLoading}
                onClick={async () => {
                  setErrors({})
                  setCode('')
                  setIsLoading(true)
                  try {
                    const payload = await api.post<any>(endpoints.auth.otpSendForgotPassword, {
                      identifier: identifier.trim(),
                    })

                    const nextUserId = String((payload as any)?.userId || (payload as any)?.data?.userId || '').trim()
                    if (nextUserId) setUserId(nextUserId)

                    toast.success('Code resent', {
                      description: 'Check your messages for the new OTP code.',
                    })
                  } catch (error) {
                    const message = error instanceof ApiError ? error.message : 'Failed to resend verification code.'
                    toast.error('Request failed', { description: message })
                  } finally {
                    setIsLoading(false)
                  }
                }}
              >
                Send again
              </Button>
            </div>
          </div>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleReset} className="grid gap-5">
          <AuthNotice className="text-muted-foreground">
            Set a new password for <span className="font-semibold text-foreground">{maskIdentifier(identifier)}</span>.
          </AuthNotice>

          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (errors.newPassword) setErrors(prev => ({ ...prev, newPassword: '' }))
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.newPassword) || undefined}
            />
            {errors.newPassword ? <p className="text-sm font-medium text-destructive">{errors.newPassword}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }))
              }}
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword) || undefined}
            />
            {errors.confirmPassword ? (
              <p className="text-sm font-medium text-destructive">{errors.confirmPassword}</p>
            ) : null}
          </div>

          {errors.resetToken ? (
            <AuthNotice tone="destructive">
              <span className="font-semibold text-destructive">{errors.resetToken}</span>
            </AuthNotice>
          ) : null}

          <div className="grid gap-3">
            <Button type="submit" className="h-11 w-full gap-2" disabled={isLoading}>
              Reset password
              <ArrowRight size={16} weight="bold" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full gap-2"
              disabled={isLoading}
              onClick={() => {
                setNewPassword('')
                setConfirmPassword('')
                setResetToken(null)
                setLocation(pathForStep('verify'))
              }}
            >
              <ArrowLeft size={16} weight="bold" />
              Back
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
