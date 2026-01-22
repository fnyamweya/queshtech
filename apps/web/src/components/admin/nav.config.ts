import type { ComponentType } from 'react'
import {
  BarChart3,
  Box,
  Building2,
  CreditCard,
  DollarSign,
  Headset,
  LayoutDashboard,
  LayoutList,
  LayoutTemplate,
  MapPinned,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Settings,
  Shapes,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
  Users,
} from 'lucide-react'

export type AxisNavItem = {
  id: string
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
  description?: string
  badge?: string
  children?: AxisNavSubItem[]
}

export type AxisNavSubItem = {
  id: string
  title: string
  href: string
  description?: string
}

export type AxisNavGroup = {
  id: string
  label: string
  items: AxisNavItem[]
}

export const AXIS_NAV: AxisNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/axis/dashboard',
        icon: LayoutDashboard,
        description: 'Live store overview',
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      { id: 'orders', title: 'Orders', href: '/axis/orders', icon: ShoppingCart, description: 'Recent and pending orders' },
      { id: 'customers', title: 'Customers', href: '/axis/customers', icon: Users, description: 'Customer profiles' },
    ],
  },
  {
    id: 'shipping',
    label: 'Shipping',
    items: [
      {
        id: 'shipping',
        title: 'Shipping',
        href: '/axis/shipping',
        icon: Truck,
        description: 'Zones, methods, providers, and rates',
        children: [
          { id: 'shipping-zones', title: 'Zones', href: '/axis/shipping', description: 'Destinations and zone setup' },
          { id: 'shipping-methods', title: 'Methods', href: '/axis/shipping/methods', description: 'Reusable shipping methods' },
          { id: 'shipping-providers', title: 'Providers', href: '/axis/shipping/providers', description: 'Carrier providers' },
        ],
      },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { id: 'collections', title: 'Collections', href: '/axis/collections', icon: LayoutList, description: 'Landing collections and banners' },
      { id: 'products', title: 'Products', href: '/axis/products', icon: Box, description: 'Catalog: products' },
      { id: 'categories', title: 'Categories', href: '/axis/categories', icon: Tags, description: 'Catalog: categories' },
      { id: 'taxonomies', title: 'Taxonomies', href: '/axis/taxonomies', icon: Shapes, description: 'Catalog: taxonomies' },
      { id: 'brands', title: 'Brands', href: '/axis/brands', icon: Building2, description: 'Catalog: brands' },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    items: [
      { id: 'price-lists', title: 'Price Lists', href: '/axis/pricing/price-lists', icon: DollarSign, description: 'Pricing contexts and priority' },
      { id: 'variant-prices', title: 'Variant Prices', href: '/axis/pricing/variant-prices', icon: DollarSign, description: 'Tiered pricing per variant' },
      { id: 'promotions', title: 'Promotions', href: '/axis/promotions', icon: Megaphone, description: 'Promo codes and scheduled offers' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [{ id: 'analytics', title: 'Analytics', href: '/axis/analytics', icon: BarChart3, description: 'Performance metrics' }],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'settings', title: 'Settings', href: '/axis/settings', icon: Settings, description: 'Configuration hub' },
      { id: 'channels', title: 'Channels', href: '/axis/channels', icon: MessageSquareText, description: 'Sales channels and configuration' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [
      { id: 'tasks', title: 'Tasks', href: '/axis/tasks', icon: Headset, description: 'Customer support tasks' },
      { id: 'chat', title: 'Chat', href: '/axis/chat', icon: MessageCircle, description: 'Operator chat' },
    ],
  },
]

export const isAxisNavActive = (currentPath: string, href: string) =>
  currentPath === href || currentPath.startsWith(`${href}/`)

export type AxisNavSearchLink = {
  label: string
  href: string
  description?: string
  icon: ComponentType<{ className?: string }>
  groupLabel: string
}

export const axisNavToSearchLinks = (): AxisNavSearchLink[] => {
  const links: AxisNavSearchLink[] = []

  for (const group of AXIS_NAV) {
    for (const item of group.items) {
      links.push({
        label: item.title,
        href: item.href,
        description: item.description,
        icon: item.icon,
        groupLabel: group.label,
      })

      if (item.children?.length) {
        for (const child of item.children) {
          links.push({
            label: child.title,
            href: child.href,
            description: child.description,
            icon: item.icon,
            groupLabel: group.label,
          })
        }
      }
    }
  }

  return links
}

export type AxisBreadcrumb = {
  label: string
  href?: string
}

export const axisBreadcrumbsForPath = (currentPath: string, pageTitle?: string): AxisBreadcrumb[] => {
  const crumbs: AxisBreadcrumb[] = [{ label: 'Axis', href: '/axis/dashboard' }]

  let best: {
    group: AxisNavGroup
    item: AxisNavItem
    child?: AxisNavSubItem
    score: number
  } | null = null

  for (const group of AXIS_NAV) {
    for (const item of group.items) {
      if (isAxisNavActive(currentPath, item.href)) {
        const score = item.href.length
        if (!best || score > best.score) best = { group, item, score }
      }

      for (const child of item.children || []) {
        if (isAxisNavActive(currentPath, child.href)) {
          const score = child.href.length
          if (!best || score > best.score) best = { group, item, child, score }
        }
      }
    }
  }

  if (best) {
    crumbs.push({ label: best.group.label })
    crumbs.push({ label: best.item.title, href: best.item.href })
    if (best.child) crumbs.push({ label: best.child.title, href: best.child.href })
  }

  // If this is a detail route, add the provided page title as the terminal crumb.
  const terminalTitle = pageTitle?.trim()
  if (terminalTitle) {
    const last = crumbs[crumbs.length - 1]
    if (!last || last.label !== terminalTitle) {
      // Avoid duplicating if the title matches an existing crumb.
      if (!crumbs.some((c) => c.label === terminalTitle)) crumbs.push({ label: terminalTitle })
    }
  }

  return crumbs
}
