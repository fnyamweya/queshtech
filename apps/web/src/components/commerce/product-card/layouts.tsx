import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ProductCardContext, ProductCardSlot, ProductCardSlots, ProductCardVariant } from './types'
import { ProductCardMedia } from './media'
import { ProductCardMeta } from './meta'
import { ProductCardPrice } from './price'
import { ProductCardOptions } from './options'
import { ProductCardSpecs } from './specs'
import { ProductCardActions } from './actions'

function resolveSlot<TProduct>(slot: ProductCardSlot<TProduct> | undefined, ctx: ProductCardContext<TProduct>) {
  if (!slot) return null
  return typeof slot === 'function' ? slot(ctx) : slot
}

function padded(ctx: ProductCardContext<any>) {
  return ctx.appearance.density === 'compact' ? 'p-3' : 'p-4'
}

function renderPrice<TProduct>(ctx: ProductCardContext<TProduct>, slot?: ProductCardSlot<TProduct>) {
  const custom = resolveSlot(slot, ctx)
  return custom ? custom : <ProductCardPrice ctx={ctx} />
}

function renderOptions<TProduct>(ctx: ProductCardContext<TProduct>, slot?: ProductCardSlot<TProduct>) {
  const custom = resolveSlot(slot, ctx)
  return custom ? custom : <ProductCardOptions ctx={ctx} />
}

function renderSpecs<TProduct>(ctx: ProductCardContext<TProduct>, slot?: ProductCardSlot<TProduct>) {
  const custom = resolveSlot(slot, ctx)
  return custom ? custom : <ProductCardSpecs ctx={ctx} />
}

export function ProductCardLayout<TProduct>({
  ctx,
  slots,
  onLinkClick,
  className,
}: {
  ctx: ProductCardContext<TProduct>
  slots?: ProductCardSlots<TProduct>
  onLinkClick?: () => void
  className?: string
}): ReactNode {
  switch (ctx.variant) {
    case 'compact':
      return (
        <div className={className}>
          {resolveSlot(slots?.Header, ctx)}
          <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} />
          <div className={cn(padded(ctx), 'space-y-2')}>
            <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
            {renderPrice(ctx, slots?.Price)}
            {renderOptions(ctx, slots?.Options)}
            <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="inline" />
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )

    case 'horizontal':
      return (
        <div className={cn(className)}>
          {resolveSlot(slots?.Header, ctx)}
          <div className={cn('flex gap-4', padded(ctx))}>
            <div className="w-28 flex-shrink-0">
              <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} className="rounded-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
                </div>
                <div className="text-right">{renderPrice(ctx, slots?.Price)}</div>
              </div>
              {renderOptions(ctx, slots?.Options)}
              {renderSpecs(ctx, slots?.Specs)}
              <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="inline" />
            </div>
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )

    case 'showcase':
    case 'editorial':
      return (
        <div className={cn(className)}>
          {resolveSlot(slots?.Header, ctx)}
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} />
            <div className={cn(padded(ctx), 'flex flex-col justify-between gap-4')}>
              <div className="space-y-3">
                <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
                {renderSpecs(ctx, slots?.Specs)}
                {renderOptions(ctx, slots?.Options)}
              </div>
              <div className="space-y-3">
                {renderPrice(ctx, slots?.Price)}
                <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="inline" />
              </div>
            </div>
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )

    case 'stacked':
      return (
        <div className={cn(className)}>
          {resolveSlot(slots?.Header, ctx)}
          <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} />
          <div className={cn(padded(ctx), 'space-y-3')}>
            <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
            {renderSpecs(ctx, slots?.Specs)}
            {renderOptions(ctx, slots?.Options)}
            {renderPrice(ctx, slots?.Price)}
            <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="inline" />
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )

    case 'comparison':
      return (
        <div className={cn(className)}>
          {resolveSlot(slots?.Header, ctx)}
          <div className={cn('flex gap-4', padded(ctx))}>
            <div className="w-24 flex-shrink-0">
              <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} className="rounded-xl" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
                </div>
                <div className="text-right">{renderPrice(ctx, slots?.Price)}</div>
              </div>
              {renderSpecs(ctx, slots?.Specs)}
              <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="inline" />
            </div>
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )

    case 'grid':
    default:
      return (
        <div className={cn(className)}>
          {resolveSlot(slots?.Header, ctx)}
          <div className="relative">
            <ProductCardMedia ctx={ctx} mediaSlot={slots?.Media} badgesSlot={slots?.Badges} />
            <ProductCardActions ctx={ctx} slot={slots?.Actions} placement="overlay" />
          </div>
          <div className={cn(padded(ctx), 'space-y-2')}>
            <ProductCardMeta ctx={ctx} onTitleClick={onLinkClick} />
            {renderOptions(ctx, slots?.Options)}
            {renderSpecs(ctx, slots?.Specs)}
            {renderPrice(ctx, slots?.Price)}
          </div>
          {resolveSlot(slots?.Footer, ctx)}
        </div>
      )
  }
}

export function normalizeVariant(variant: ProductCardVariant | undefined): ProductCardVariant {
  return variant || 'grid'
}

