# ProductCard guide

`ProductCard` is designed to be a reusable “product tile” that can switch layouts, visuals, and feature flags per list (home carousels, category grids, search results, related items, etc.).

Source: `apps/web/src/components/commerce/product-card.tsx`

## Quick start

```tsx
<ProductCard product={product} onAddToCart={addToCart} />
```

## Layout variants

- `variant="grid"` (default): modern tile with image, badges, price, and hover actions.
- `variant="compact"`: tight tile for horizontal carousels.
- `variant="horizontal"`: row layout for list views.
- `variant="showcase"`: featured layout (bigger copy + CTA).

## Presets (visual style)

Use `config.preset` to quickly change the “feel”:

- `default`: clean card with border + hover shadow.
- `soft`: slightly softer hover behavior (same structure).
- `glass`: translucent / blurred card shell.
- `elevated`: more prominent shadow.
- `minimal`: strips most UI chrome (good for dense lists).

Example:

```tsx
<ProductCard
  product={product}
  onAddToCart={addToCart}
  config={{ preset: 'glass' }}
/>
```

## Feature flags & behaviors (config overrides)

The component supports per-list configuration via `config`:

```ts
config?: {
  preset?: 'default' | 'soft' | 'glass' | 'minimal' | 'elevated'
  density?: 'comfortable' | 'compact'
  media?: { aspect?: 'square' | 'portrait' | 'auto'; hoverSwap?: boolean; showGradient?: boolean }
  badges?: {
    show?: boolean
    max?: number
    includeProductBadges?: boolean
    includeDiscountBadge?: boolean
    items?: Array<{ label: string; variant?: 'default' | 'secondary' | 'success' | 'info' | 'warning' | 'destructive' | 'outline' }>
  }
  meta?: { showBrand?: boolean; showRating?: boolean; showStockHint?: boolean }
  actions?: { mode?: 'none' | 'hover' | 'always'; showAddToCart?: boolean; showQuickView?: boolean; showWishlist?: boolean }
}
```

### Custom badges

Override badge rendering per list:

```tsx
<ProductCard
  product={product}
  onAddToCart={addToCart}
  config={{
    badges: {
      includeProductBadges: false,
      includeDiscountBadge: true,
      max: 2,
      items: [
        { label: 'Free delivery', variant: 'info' },
        { label: '2-year warranty', variant: 'success' },
      ],
    },
  }}
/>
```

### Quick view & wishlist

Buttons only appear when you provide handlers:

```tsx
<ProductCard
  product={product}
  onQuickView={(p) => setQuickView(p)}
  onWishlistToggle={(p) => toggleWishlist(p.id)}
  isWishlisted={wishlistIds.has(product.id)}
/>
```

### List view example (horizontal)

```tsx
<ProductCard
  product={product}
  variant="horizontal"
  onAddToCart={addToCart}
  config={{ preset: 'minimal', actions: { mode: 'always' } }}
/>
```

## Notes

- `href` can override the destination URL (defaults to `/product/${product.slug}`).
- Actions are kept usable on touch devices (no “hover-only” dead ends).
- Badges support multiple items; mapping from `ProductBadge.type` is handled internally.

