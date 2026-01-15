import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  InstagramLogo,
  TwitterLogo,
  FacebookLogo,
  TiktokLogo,
  EnvelopeSimple,
  Phone,
  MapPin,
} from '@phosphor-icons/react'

const footerLinks = {
  shop: [
    { name: 'Smartphones', href: '/category/smartphones-tablets' },
    { name: 'Laptops', href: '/category/computers-laptops' },
    { name: 'Gaming', href: '/category/gaming' },
    { name: 'Audio', href: '/category/audio-headphones' },
  ],
  support: [
    { name: 'Help Center', href: '/help' },
    { name: 'Track Order', href: '/track' },
    { name: 'Shipping & Returns', href: '/shipping' },
    { name: 'Warranty', href: '/warranty' },
  ],
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Careers', href: '/careers' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Return Policy', href: '/returns' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-10">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <Link href="/">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-cyber-cyan flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <h2
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  QueshTech
                </h2>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
              Kenya's premier destination for cutting-edge electronics and technology. 
              Quality products, competitive prices, reliable service.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={16} />
                <a href="tel:+254712345678" className="hover:text-primary transition-colors">
                  +254 712 345 678
                </a>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <EnvelopeSimple size={16} />
                <a href="mailto:support@queshtech.co.ke" className="hover:text-primary transition-colors">
                  support@queshtech.co.ke
                </a>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                <span>Kimathi Street, Nairobi CBD, Kenya</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">Shop</h3>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">Support</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            © {new Date().getFullYear()} QueshTech. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Follow us:</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                  <InstagramLogo size={20} weight="fill" />
                  <span className="sr-only">Instagram</span>
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                  <TwitterLogo size={20} weight="fill" />
                  <span className="sr-only">Twitter</span>
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                  <FacebookLogo size={20} weight="fill" />
                  <span className="sr-only">Facebook</span>
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">
                  <TiktokLogo size={20} weight="fill" />
                  <span className="sr-only">TikTok</span>
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>Payment methods:</span>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-muted rounded text-xs font-semibold">M-PESA</span>
              <span className="px-2 py-1 bg-muted rounded text-xs font-semibold">VISA</span>
              <span className="px-2 py-1 bg-muted rounded text-xs font-semibold">Mastercard</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
