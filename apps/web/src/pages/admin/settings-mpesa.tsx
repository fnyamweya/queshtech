import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { CornerDownRight, CreditCard, Link2, ShieldCheck, TestTube2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { createApiClient } from '@/lib/api-client'
import { endpoints } from '@/lib/endpoints'
import { useAdminAuth } from '@/hooks/use-admin-auth'

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function AdminSettingsMpesaPage() {
  const { accessToken } = useAdminAuth()
  const api = useMemo(() => createApiClient({ token: accessToken }), [accessToken])

  const [activeTab, setActiveTab] = useState<'c2b' | 'b2c' | 'b2b'>('c2b')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<string>('')

  // C2B: register urls
  const [c2bShortCode, setC2bShortCode] = useState('')
  const [c2bResponseType, setC2bResponseType] = useState<'Completed' | 'Cancelled'>('Completed')
  const [c2bValidationUrl, setC2bValidationUrl] = useState('')
  const [c2bConfirmationUrl, setC2bConfirmationUrl] = useState('')

  // C2B: simulate
  const [simShortCode, setSimShortCode] = useState('')
  const [simAmount, setSimAmount] = useState('100')
  const [simMsisdn, setSimMsisdn] = useState('254708374149')
  const [simBillRef, setSimBillRef] = useState('INV-1001')
  const [simCommandId, setSimCommandId] = useState<'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline'>('CustomerPayBillOnline')

  // B2C
  const [b2cAmount, setB2cAmount] = useState('')
  const [b2cPartyB, setB2cPartyB] = useState('')
  const [b2cRemarks, setB2cRemarks] = useState('Withdrawal')
  const [b2cOccasion, setB2cOccasion] = useState('')
  const [b2cOrderId, setB2cOrderId] = useState('')
  const [b2cCommandId, setB2cCommandId] = useState('BusinessPayment')
  const [b2cPartyA, setB2cPartyA] = useState('')
  const [b2cInitiatorName, setB2cInitiatorName] = useState('')
  const [b2cSecurityCredential, setB2cSecurityCredential] = useState('')
  const [b2cResultUrl, setB2cResultUrl] = useState('')
  const [b2cQueueTimeoutUrl, setB2cQueueTimeoutUrl] = useState('')

  // B2B
  const [b2bAmount, setB2bAmount] = useState('')
  const [b2bPartyB, setB2bPartyB] = useState('')
  const [b2bAccountRef, setB2bAccountRef] = useState('INV-1001')
  const [b2bRemarks, setB2bRemarks] = useState('Settlement')
  const [b2bOrderId, setB2bOrderId] = useState('')
  const [b2bCommandId, setB2bCommandId] = useState('BusinessPayBill')
  const [b2bPartyA, setB2bPartyA] = useState('')
  const [b2bInitiatorName, setB2bInitiatorName] = useState('')
  const [b2bSecurityCredential, setB2bSecurityCredential] = useState('')
  const [b2bResultUrl, setB2bResultUrl] = useState('')
  const [b2bQueueTimeoutUrl, setB2bQueueTimeoutUrl] = useState('')

  const run = async (actionLabel: string, fn: () => Promise<unknown>) => {
    setIsSubmitting(true)
    setLastAction(actionLabel)
    setLastResponse('')
    try {
      const resp = await fn()
      setLastResponse(safeJson(resp))
      toast.success('Request sent', { description: actionLabel })
    } catch (e: any) {
      const message = e?.message || 'Request failed'
      setLastResponse(safeJson({ error: message }))
      toast.error('M-Pesa request failed', { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout
      title="Settings · M-Pesa (Daraja)"
      description="Register callbacks, simulate sandbox payments, and initiate B2C/B2B payouts via Daraja."
      actions={
        <Link href="/axis/settings">
          <Button variant="outline" size="sm">
            <CornerDownRight className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                M-Pesa controls
              </CardTitle>
              <CardDescription>
                Use the forms below to perform Daraja actions. Fields marked required match the API DTOs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="c2b">C2B</TabsTrigger>
                  <TabsTrigger value="b2c">B2C</TabsTrigger>
                  <TabsTrigger value="b2b">B2B</TabsTrigger>
                </TabsList>

                <TabsContent value="c2b" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Register C2B URLs
                      </CardTitle>
                      <CardDescription>
                        Registers your confirmation + validation callbacks. If URLs are empty, the backend uses its defaults.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Short code (required)</Label>
                          <Input value={c2bShortCode} onChange={(e) => setC2bShortCode(e.target.value)} placeholder="600000" />
                        </div>
                        <div className="space-y-2">
                          <Label>Response type</Label>
                          <Select value={c2bResponseType} onValueChange={(v) => setC2bResponseType(v as any)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select response type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Validation URL (optional)</Label>
                          <Input
                            value={c2bValidationUrl}
                            onChange={(e) => setC2bValidationUrl(e.target.value)}
                            placeholder="Leave empty to use backend default"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Confirmation URL (optional)</Label>
                          <Input
                            value={c2bConfirmationUrl}
                            onChange={(e) => setC2bConfirmationUrl(e.target.value)}
                            placeholder="Leave empty to use backend default"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() =>
                            run('C2B Register URLs', () =>
                              api.post(endpoints.mpesa.c2bRegisterUrls, {
                                shortCode: c2bShortCode.trim(),
                                responseType: c2bResponseType,
                                validationUrl: c2bValidationUrl.trim() || undefined,
                                confirmationUrl: c2bConfirmationUrl.trim() || undefined,
                              })
                            )
                          }
                          disabled={isSubmitting || !c2bShortCode.trim()}
                        >
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          Register URLs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TestTube2 className="h-5 w-5" />
                        Simulate C2B (sandbox)
                      </CardTitle>
                      <CardDescription>
                        Sends a sandbox simulation. Requires short code, amount, MSISDN, and bill ref.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Short code (required)</Label>
                          <Input value={simShortCode} onChange={(e) => setSimShortCode(e.target.value)} placeholder="600000" />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (required)</Label>
                          <Input value={simAmount} onChange={(e) => setSimAmount(e.target.value)} placeholder="100" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>MSISDN (required)</Label>
                          <Input value={simMsisdn} onChange={(e) => setSimMsisdn(e.target.value)} placeholder="2547XXXXXXXX" />
                        </div>
                        <div className="space-y-2">
                          <Label>Bill ref number (required)</Label>
                          <Input value={simBillRef} onChange={(e) => setSimBillRef(e.target.value)} placeholder="INV-1001" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Command ID</Label>
                        <Select value={simCommandId} onValueChange={(v) => setSimCommandId(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select command" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CustomerPayBillOnline">CustomerPayBillOnline</SelectItem>
                            <SelectItem value="CustomerBuyGoodsOnline">CustomerBuyGoodsOnline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() =>
                            run('C2B Simulate', () =>
                              api.post(endpoints.mpesa.c2bSimulate, {
                                shortCode: simShortCode.trim(),
                                amount: Number(simAmount),
                                msisdn: simMsisdn.trim(),
                                billRefNumber: simBillRef.trim(),
                                commandId: simCommandId,
                              })
                            )
                          }
                          disabled={isSubmitting || !simShortCode.trim() || !simAmount.trim() || !simMsisdn.trim() || !simBillRef.trim()}
                        >
                          <TestTube2 className="h-4 w-4 mr-2" />
                          Run simulation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="b2c" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Initiate B2C payment
                      </CardTitle>
                      <CardDescription>
                        Required: amount, partyB, remarks. Advanced fields override backend defaults.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Amount (required)</Label>
                          <Input value={b2cAmount} onChange={(e) => setB2cAmount(e.target.value)} placeholder="100" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Recipient phone / PartyB (required)</Label>
                          <Input value={b2cPartyB} onChange={(e) => setB2cPartyB(e.target.value)} placeholder="2547XXXXXXXX" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Remarks (required)</Label>
                          <Input value={b2cRemarks} onChange={(e) => setB2cRemarks(e.target.value)} placeholder="Withdrawal" />
                        </div>
                        <div className="space-y-2">
                          <Label>Occasion (optional)</Label>
                          <Input value={b2cOccasion} onChange={(e) => setB2cOccasion(e.target.value)} placeholder="Order#123" />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Order ID (optional)</Label>
                          <Input value={b2cOrderId} onChange={(e) => setB2cOrderId(e.target.value)} placeholder="UUID" />
                        </div>
                        <div className="space-y-2">
                          <Label>Command ID</Label>
                          <Input value={b2cCommandId} onChange={(e) => setB2cCommandId(e.target.value)} placeholder="BusinessPayment" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>PartyA (optional)</Label>
                          <Input value={b2cPartyA} onChange={(e) => setB2cPartyA(e.target.value)} placeholder="Shortcode (defaults to env)" />
                        </div>
                        <div className="space-y-2">
                          <Label>Initiator name (optional)</Label>
                          <Input value={b2cInitiatorName} onChange={(e) => setB2cInitiatorName(e.target.value)} placeholder="Defaults to env" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Security credential (optional)</Label>
                        <Input
                          value={b2cSecurityCredential}
                          onChange={(e) => setB2cSecurityCredential(e.target.value)}
                          placeholder="Defaults to env"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Result URL (optional)</Label>
                          <Input value={b2cResultUrl} onChange={(e) => setB2cResultUrl(e.target.value)} placeholder="Leave empty to use backend default" />
                        </div>
                        <div className="space-y-2">
                          <Label>Queue timeout URL (optional)</Label>
                          <Input value={b2cQueueTimeoutUrl} onChange={(e) => setB2cQueueTimeoutUrl(e.target.value)} placeholder="Leave empty to use backend default" />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() =>
                            run('B2C Payment', () =>
                              api.post(endpoints.mpesa.b2cPayment, {
                                amount: Number(b2cAmount),
                                partyB: b2cPartyB.trim(),
                                remarks: b2cRemarks.trim(),
                                ...(b2cOccasion.trim() ? { occasion: b2cOccasion.trim() } : {}),
                                ...(b2cOrderId.trim() ? { orderId: b2cOrderId.trim() } : {}),
                                ...(b2cCommandId.trim() ? { commandId: b2cCommandId.trim() } : {}),
                                ...(b2cPartyA.trim() ? { partyA: b2cPartyA.trim() } : {}),
                                ...(b2cInitiatorName.trim() ? { initiatorName: b2cInitiatorName.trim() } : {}),
                                ...(b2cSecurityCredential.trim() ? { securityCredential: b2cSecurityCredential.trim() } : {}),
                                ...(b2cResultUrl.trim() ? { resultUrl: b2cResultUrl.trim() } : {}),
                                ...(b2cQueueTimeoutUrl.trim() ? { queueTimeoutUrl: b2cQueueTimeoutUrl.trim() } : {}),
                              })
                            )
                          }
                          disabled={isSubmitting || !b2cAmount.trim() || !b2cPartyB.trim() || !b2cRemarks.trim()}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Initiate B2C
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="b2b" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Initiate B2B payment
                      </CardTitle>
                      <CardDescription>
                        Required: amount, partyB, accountReference, remarks.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Amount (required)</Label>
                          <Input value={b2bAmount} onChange={(e) => setB2bAmount(e.target.value)} placeholder="100" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Recipient shortcode / PartyB (required)</Label>
                          <Input value={b2bPartyB} onChange={(e) => setB2bPartyB(e.target.value)} placeholder="600000" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Account reference (required)</Label>
                          <Input value={b2bAccountRef} onChange={(e) => setB2bAccountRef(e.target.value)} placeholder="INV-1001" />
                        </div>
                        <div className="space-y-2">
                          <Label>Remarks (required)</Label>
                          <Input value={b2bRemarks} onChange={(e) => setB2bRemarks(e.target.value)} placeholder="Settlement" />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Order ID (optional)</Label>
                          <Input value={b2bOrderId} onChange={(e) => setB2bOrderId(e.target.value)} placeholder="UUID" />
                        </div>
                        <div className="space-y-2">
                          <Label>Command ID</Label>
                          <Input value={b2bCommandId} onChange={(e) => setB2bCommandId(e.target.value)} placeholder="BusinessPayBill" />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>PartyA (optional)</Label>
                          <Input value={b2bPartyA} onChange={(e) => setB2bPartyA(e.target.value)} placeholder="Shortcode (defaults to env)" />
                        </div>
                        <div className="space-y-2">
                          <Label>Initiator name (optional)</Label>
                          <Input value={b2bInitiatorName} onChange={(e) => setB2bInitiatorName(e.target.value)} placeholder="Defaults to env" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Security credential (optional)</Label>
                        <Input
                          value={b2bSecurityCredential}
                          onChange={(e) => setB2bSecurityCredential(e.target.value)}
                          placeholder="Defaults to env"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Result URL (optional)</Label>
                          <Input value={b2bResultUrl} onChange={(e) => setB2bResultUrl(e.target.value)} placeholder="Leave empty to use backend default" />
                        </div>
                        <div className="space-y-2">
                          <Label>Queue timeout URL (optional)</Label>
                          <Input value={b2bQueueTimeoutUrl} onChange={(e) => setB2bQueueTimeoutUrl(e.target.value)} placeholder="Leave empty to use backend default" />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() =>
                            run('B2B Payment', () =>
                              api.post(endpoints.mpesa.b2bPayment, {
                                amount: Number(b2bAmount),
                                partyB: b2bPartyB.trim(),
                                accountReference: b2bAccountRef.trim(),
                                remarks: b2bRemarks.trim(),
                                ...(b2bOrderId.trim() ? { orderId: b2bOrderId.trim() } : {}),
                                ...(b2bCommandId.trim() ? { commandId: b2bCommandId.trim() } : {}),
                                ...(b2bPartyA.trim() ? { partyA: b2bPartyA.trim() } : {}),
                                ...(b2bInitiatorName.trim() ? { initiatorName: b2bInitiatorName.trim() } : {}),
                                ...(b2bSecurityCredential.trim() ? { securityCredential: b2bSecurityCredential.trim() } : {}),
                                ...(b2bResultUrl.trim() ? { resultUrl: b2bResultUrl.trim() } : {}),
                                ...(b2bQueueTimeoutUrl.trim() ? { queueTimeoutUrl: b2bQueueTimeoutUrl.trim() } : {}),
                              })
                            )
                          }
                          disabled={isSubmitting || !b2bAmount.trim() || !b2bPartyB.trim() || !b2bAccountRef.trim() || !b2bRemarks.trim()}
                        >
                          <Wallet className="h-4 w-4 mr-2" />
                          Initiate B2B
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run log</CardTitle>
              <CardDescription>Last request outcome for fast iteration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{lastAction ? lastAction : 'Idle'}</Badge>
              </div>
              <Textarea readOnly value={lastResponse} placeholder="Responses will appear here…" className="min-h-[320px] font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                Tip: Daraja callbacks (validation/confirmation/result/timeout) are handled by the backend endpoints shown in Swagger.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API paths</CardTitle>
              <CardDescription>These calls use your configured API prefix.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">C2B register</span>
                <code className="text-xs">{endpoints.mpesa.c2bRegisterUrls}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">C2B simulate</span>
                <code className="text-xs">{endpoints.mpesa.c2bSimulate}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">B2C payment</span>
                <code className="text-xs">{endpoints.mpesa.b2cPayment}</code>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">B2B payment</span>
                <code className="text-xs">{endpoints.mpesa.b2bPayment}</code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
