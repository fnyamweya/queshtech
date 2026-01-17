# ProductCard guide

`ProductCard` is a composable product tile built for “per-list customization” (home carousels, category grids, search results, related items, B2B catalogs, etc.) without forking the component.

Source (orchestrator): `apps/web/src/components/commerce/product-card.tsx`  
Primitives: `apps/web/src/components/commerce/product-card/`

## Quick start (works everywhere)

```tsx
<ProductCard product={product} onAddToCart={addToCart} />
```

`onAddToCart`, `onQuickView`, `onWishlistToggle`, and the old `config` prop are still supported for a smooth migration.

---

## New API (recommended)

`ProductCard` is now split into three layers:

- `appearance`: purely visual (preset, density, media)
- `behavior`: interactions + feature flags + telemetry + a11y policies
- `adapter`: how to read fields from *your* product model (price model, inventory model, rating source, etc.)

And a sophistication multiplier:

- `slots`: override pieces (Header/Footer/Badges/Price/Options/Specs/Actions/Media) without forking layouts

### Props overview

```ts
type ProductCardProps<TProduct> = {
  product: TProduct
  variant?: 'grid' | 'compact' | 'horizontal' | 'showcase' | 'stacked' | 'editorial' | 'comparison'
  href?: string
  loading?: boolean
  appearance?: { preset?; density?; media? }
  behavior?: {
    actions?: { mode?; showAdd?; showQuickView?; showWishlist?; onQuickView?; onWishlistToggle?; wishlisted? }
    meta?: { showBrand?; showRating?; showStockHint?; stockThreshold? }
    badges?: { show?; max?; items? }
    price?: { mode?; showSavings?; explanation? }
    options?: { show?; mode?; maxVisible?; onSelect? }
    purchase?: { mode?; quantity?; onPurchase?; onUndoPurchase? }
    discovery?: { compare?; reason?; highlightTerms? }
    specs?: { show?; max?; items? }
    interaction?: { feedback?; undoAddToCart? }
    experiments?: { key?; variant?: 'A' | 'B' | 'C' }
    telemetry?: { onImpression?; onClick?; onAction? }
    a11y?: { focusRing?; linkStrategy? }
    content?: { showDescription?; titleClamp?; descriptionClamp? }
  }
  adapter?: ProductCardAdapter<TProduct>
  slots?: ProductCardSlots<TProduct>
}
```

---

## Appearance presets & variants

### `variant`

- `grid` (default): classic tile
- `compact`: for horizontal carousels
- `horizontal`: list view / dense results
- `showcase`: featured tile
- `stacked`: taller, mobile-first “CTA last”
- `comparison`: compact + specs-friendly
- `editorial`: featured / brand storytelling (currently uses the showcase layout)

### `appearance.preset`

Useful for changing the “feel” per list:

- `default`, `soft`, `glass`, `elevated`, `minimal`, `premium`, `outline`, `dark`

Example:

```tsx
<ProductCard product={product} appearance={{ preset: 'glass' }} />
```

---

## Slots (override without forking)

Slots can be a `ReactNode` or a function: `(ctx) => ReactNode`.

```tsx
<ProductCard
  product={product}
  slots={{
    Footer: (ctx) => (
      <div className="p-4 pt-0 text-xs text-muted-foreground">
        Because you viewed <span className="font-medium text-foreground">{ctx.brand}</span>
      </div>
    ),
    Price: (ctx) => (
      <div className="text-sm font-semibold">
        {ctx.currency} {ctx.price}
      </div>
    ),
  }}
/>
```

Common high-impact overrides:

- `Badges`: render custom badges (free delivery, warranty, regulated item)
- `Actions`: swap CTA from “Add” to “Quote”, add compare checkbox, etc.
- `Media`: category-specific media styling (e.g. gradient overlays per list)

---

## Search results (highlight + savings)

```tsx
<ProductCard
  product={product}
  onAddToCart={addToCart}
  behavior={{
    discovery: { highlightTerms: query.split(/\s+/).filter(Boolean) },
    price: { showSavings: 'percent' },
    badges: { max: 2 },
  }}
/>
```

---

## Real commerce modes (add / subscribe / quote / preorder / notify)

### B2B quote with quantity stepper

```tsx
<ProductCard
  product={product}
  behavior={{
    purchase: {
      mode: 'quote',
      quantity: { show: true, min: 10, step: 5 },
      onPurchase: ({ product, quantity }) => requestQuote(product.id, quantity),
    },
    interaction: { feedback: 'toast' },
  }}
/>
```

### Add-to-cart + “Undo”

```tsx
<ProductCard
  product={product}
  onAddToCart={addToCart}
  behavior={{
    interaction: { feedback: 'toast', undoAddToCart: { enabled: true, windowMs: 5000 } },
    purchase: {
      onUndoPurchase: ({ product, selected }) => removeFromCart(product, selected),
    },
  }}
/>
```

---

## Adapter (use ProductCard with any product model)

If your list uses a different product shape (aggregator/search index/B2B ERP), pass an adapter:

```tsx
type SearchHit = { objectID: string; title: string; img: string; price: number; currency: string }

const adapter = {
  getId: (p: SearchHit) => p.objectID,
  getHref: (p: SearchHit) => `/product/${p.objectID}`,
  getTitle: (p: SearchHit) => p.title,
  getImages: (p: SearchHit) => [{ url: p.img, isPrimary: true }],
  getPrice: (p: SearchHit) => p.price,
  getCurrency: (p: SearchHit) => p.currency,
  getInStock: () => true,
  getBadges: () => [],
  getOptionGroups: () => [],
  getSpecs: () => [],
}

<ProductCard product={hit} adapter={adapter} />
```

---

## Telemetry & experiments (experimentation-ready)

```tsx
<ProductCard
  product={product}
  behavior={{
    experiments: { key: 'search_price_layout', variant: 'B' },
    telemetry: {
      onImpression: ({ product }) => track('card_impression', { id: (product as any).id }),
      onClick: ({ href }) => track('card_click', { href }),
      onAction: ({ action, meta }) => track('card_action', { action, ...meta }),
    },
  }}
/>
```

---

## A11y & device correctness

- `actions.mode='hover'` automatically behaves like `always` on touch devices.
- `a11y.linkStrategy='wrap'` (default) makes the whole card clickable without nesting links.
- Use `a11y.linkStrategy='title-only'` for very dense tables/lists where nested interactions are common.

