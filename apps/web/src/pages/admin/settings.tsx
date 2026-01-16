import { useMemo } from 'react'
import { Link } from 'wouter'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type SettingsLink = {
  title: string
  description: string
  href: string
  cta: string
}

export function AdminSettingsPage() {
  const sections: { title: string; description?: string; links: SettingsLink[] }[] = [
    {
      title: 'Authentication',
      description: 'Configure admin sign-in providers and credentials.',
      links: [
        {
          title: 'OAuth (Admin)',
          description: 'Configure Google and Apple OAuth credentials for admin sign-in (secrets saved separately).',
          href: '/axis/settings/oauth',
          cta: 'Open OAuth',
        },
      ],
    },
    {
      title: 'Messaging',
      description: 'Configure customer communication channels and run test sends.',
      links: [
        {
          title: 'WhatsApp',
          description: 'Manage WhatsApp credentials, webhooks, and test messages.',
          href: '/axis/settings/whatsapp',
          cta: 'Open WhatsApp',
        },
        {
          title: 'WhatsApp Templates',
          description: 'Create reusable WhatsApp message templates.',
          href: '/axis/settings/whatsapp/templates',
          cta: 'Manage Templates',
        },
        {
          title: 'SMS',
          description: 'Manage SMS provider settings and test messages.',
          href: '/axis/settings/sms',
          cta: 'Open SMS',
        },
      ],
    },
    {
      title: 'Operations',
      description: 'Store configuration used by checkout and fulfillment.',
      links: [
        {
          title: 'Currencies',
          description: 'Manage currency codes, symbols, and minor units.',
          href: '/axis/settings/currencies',
          cta: 'Manage Currencies',
        },
        {
          title: 'R2 (Object Storage)',
          description: 'Configure Cloudflare R2 (S3-compatible) storage and credentials.',
          href: '/axis/settings/r2',
          cta: 'Open R2',
        },
        {
          title: 'Locations',
          description: 'Create and organize countries, counties, sub-counties, wards, and towns.',
          href: '/axis/settings/locations',
          cta: 'Manage Locations',
        },
        {
          title: 'M-Pesa (Daraja)',
          description: 'Register callbacks, simulate sandbox payments, and initiate B2C/B2B transfers.',
          href: '/axis/settings/mpesa',
          cta: 'Open M-Pesa',
        },
        {
          title: 'Algolia (Search)',
          description: 'Configure full-text catalog search for the storefront (products only).',
          href: '/axis/settings/algolia',
          cta: 'Open Algolia',
        },
      ],
    },
    {
      title: 'Merchandising',
      description: 'Control landing page content and storefront highlights.',
      links: [
        {
          title: 'Landing Page',
          description: 'Choose which collections, product lists, and banners appear on home.',
          href: '/axis/settings/landing',
          cta: 'Open Landing Page',
        },
      ],
    },
    {
      title: 'Access',
      description: 'Control who can do what in the admin.',
      links: [
        {
          title: 'Roles & Permissions',
          description: 'Create roles and assign permission sets.',
          href: '/axis/settings/roles',
          cta: 'Manage Roles',
        },
      ],
    },
  ]

  return (
    <AdminLayout
      title="Settings"
      description="Manage configuration for authentication, messaging, operations, and access control."
    >
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide">{section.title}</h2>
              {section.description ? <p className="text-sm text-muted-foreground mt-1">{section.description}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {section.links.map((link) => (
                <Card key={link.href} className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-end">
                    <Button asChild variant="outline">
                      <Link href={link.href}>{link.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminLayout>
  )
}
