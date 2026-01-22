import { useEffect, useMemo, useState } from 'react'
import { useLocation, useRoute } from 'wouter'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Price } from '@/components/commerce/price'
import { endpoints } from '@/lib/endpoints'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

type InvoiceItem = {
  id: string
  name: string
  quantity: number
  total: string
}

type InvoiceSummary = {
  id: string
  orderNumber: string
  customerName?: string | null
  customerEmail?: string | null
  currencyCode: string
  status: string
  itemsSubtotal: string
  discountTotal: string
  shippingSubtotal: string
  shippingTotal: string
  taxTotal: string
  shippingTax: string
  grandTotal: string
  shippingMethodLabel?: string
  shippingRate?: string
  shippingQuoteNote?: string
  items: InvoiceItem[]
}

const unwrap = (payload: any) => payload?.data ?? payload

type PaymentMethod = 'paystack' | 'mpesa' | 'tingg'

const paymentOptions: Array<{ id: PaymentMethod; label: string; description: string }> = [
  { id: 'paystack', label: 'Paystack', description: 'Pay with cards, bank transfer, or mobile money.' },
  { id: 'mpesa', label: 'M-Pesa', description: 'Pay via STK push on your phone.' },
  { id: 'tingg', label: 'Tingg', description: 'Pay with mobile money, cards, or wallets.' },
]

export function PayOrderPage() {
  const [, params] = useRoute('/pay/:orderId')
  const [location, setLocation] = useLocation()
  const { isAuthenticated, authorizedRequest } = useAuth()

  const orderId = params?.orderId || ''
  const token = useMemo(() => {
    const qs = location.split('?')[1]
    if (!qs) return ''
    return new URLSearchParams(qs).get('token') || ''
  }, [location])

  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paystack')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!orderId || !token) return
    let mounted = true
    setIsLoading(true)
    ;(async () => {
      try {
        const payload = await apiRequest<any>(endpoints.orders.invoiceSummary(orderId, token))
        const data = unwrap(payload)
        if (!mounted) return
        setInvoice(data as InvoiceSummary)
      } catch (e: any) {
        if (!mounted) return
        toast.error('Unable to load invoice', { description: e?.message || 'Please check the link and try again.' })
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [orderId, token])

  const totalTax = useMemo(() => {
    const tax = Number(invoice?.taxTotal || 0)
    const shippingTax = Number(invoice?.shippingTax || 0)
    return tax + shippingTax
  }, [invoice?.shippingTax, invoice?.taxTotal])

  const handlePay = async () => {
    if (!invoice) return
    if (!isAuthenticated) {
      setLocation(`/login?redirect=${encodeURIComponent(location)}`)
      return
    }

    setIsPaying(true)
    try {
      if (paymentMethod === 'paystack') {
        const payload = await authorizedRequest<any>(endpoints.paystack.initialize, {
          method: 'POST',
          body: { orderId: invoice.id },
        })
        const data = unwrap(payload)
        const url = data?.data?.authorization_url || data?.authorization_url
        if (!url) throw new Error('Missing Paystack authorization URL')
        window.location.href = url
        return
      }

      if (!phone.trim()) {
        toast.error('Phone number is required')
        return
      }

      if (paymentMethod === 'mpesa') {
        const payload = await authorizedRequest<any>(endpoints.mpesa.stkPush, {
          method: 'POST',
          body: {
            phone: phone.trim(),
            amount: Number(invoice.grandTotal || 0),
            orderId: invoice.id,
            accountReference: invoice.orderNumber,
            transactionDesc: invoice.orderNumber ? `Order ${invoice.orderNumber}` : undefined,
          },
        })
        const data = unwrap(payload)
        toast.success('STK push sent', { description: data?.CustomerMessage || data?.ResponseDescription || 'Approve the prompt on your phone.' })
        return
      }

      if (paymentMethod === 'tingg') {
        const payload = await authorizedRequest<any>(endpoints.tingg.checkout, {
          method: 'POST',
          body: {
            orderId: invoice.id,
            amount: Number(invoice.grandTotal || 0),
            currency: invoice.currencyCode,
            phone: phone.trim(),
            firstName: invoice.customerName?.split(' ')[0] || 'Customer',
            lastName: invoice.customerName?.split(' ').slice(1).join(' ') || 'Order',
            email: invoice.customerEmail || undefined,
          },
        })
        const data = unwrap(payload)
        const url = data?.data?.checkout_url || data?.checkout_url || data?.checkoutUrl
        if (!url) throw new Error('Missing Tingg checkout URL')
        window.location.href = url
        return
      }
    } catch (e: any) {
      toast.error('Failed to start payment', { description: e?.message || 'Please try again.' })
    } finally {
      setIsPaying(false)
    }
  }

  if (!orderId || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <Card className="p-6 max-w-lg w-full">
          <h2 className="text-lg font-semibold">Invalid payment link</h2>
          <p className="text-sm text-muted-foreground mt-2">The link is missing required information.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/10 flex items-center justify-center px-4 py-12">
      <Card className="max-w-2xl w-full p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pay for order</p>
            <h1 className="text-2xl font-semibold">{invoice?.orderNumber || 'Loading...'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invoice?.customerName || invoice?.customerEmail || 'Customer'}
            </p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {invoice?.status || 'pending'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading invoice…</div>
        ) : invoice ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Payment provider</Label>
              <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <div className="space-y-3">
                  {paymentOptions.map((option) => (
                    <Label
                      key={option.id}
                      htmlFor={`payment-${option.id}`}
                      className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                    >
                      <RadioGroupItem id={`payment-${option.id}`} value={option.id} />
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>

              {(paymentMethod === 'mpesa' || paymentMethod === 'tingg') && (
                <div className="space-y-2">
                  <Label htmlFor="payment-phone">Phone number</Label>
                  <Input
                    id="payment-phone"
                    placeholder="2547…"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              {invoice.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">Qty {item.quantity}</p>
                  </div>
                  <Price price={Number(item.total || 0)} currency={invoice.currencyCode} size="sm" />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Items subtotal</span>
                <Price price={Number(invoice.itemsSubtotal || 0)} currency={invoice.currencyCode} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>Discounts</span>
                <Price price={Number(invoice.discountTotal || 0)} currency={invoice.currencyCode} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <Price price={Number(invoice.shippingTotal || 0)} currency={invoice.currencyCode} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <Price price={Number(totalTax || 0)} currency={invoice.currencyCode} size="sm" />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Shipping method</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.shippingMethodLabel || 'Shipping'}
                  </p>
                </div>
                <Price
                  price={Number(invoice.shippingRate || invoice.shippingSubtotal || 0)}
                  currency={invoice.currencyCode}
                  size="sm"
                />
              </div>
              {invoice.shippingQuoteNote ? (
                <p className="text-xs text-muted-foreground">{invoice.shippingQuoteNote}</p>
              ) : null}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Shipping tax</span>
                <Price price={Number(invoice.shippingTax || 0)} currency={invoice.currencyCode} size="sm" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total due</span>
              <Price price={Number(invoice.grandTotal || 0)} currency={invoice.currencyCode} size="lg" />
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Invoice not available.</div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={handlePay} disabled={isPaying || !invoice}>
            {isAuthenticated
              ? isPaying
                ? 'Processing…'
                : paymentMethod === 'paystack'
                  ? 'Pay with Paystack'
                  : paymentMethod === 'mpesa'
                    ? 'Send STK push'
                    : 'Pay with Tingg'
              : 'Sign in to pay'}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={!invoice}
            onClick={() => window.open(endpoints.orders.invoicePdf(orderId, token), '_blank')}
          >
            Download PDF
          </Button>
        </div>
      </Card>
    </div>
  )
}
