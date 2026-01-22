import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

export interface FuturisticHeroSlide {
  id: string
  title: string
  subtitle: string
  description: string
  image: string
  cta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  badge?: string
}

const DEFAULT_SLIDES: FuturisticHeroSlide[] = [
  {
    id: 'hero-1',
    title: 'New season deals',
    subtitle: 'Fresh drops • Curated picks',
    description: 'Discover flagship phones, AI laptops, creator gear, and smart home essentials—handpicked for speed and quality.',
    image: 'https://m.media-amazon.com/images/I/71qcoYgEhzL._SX3000_.jpg',
    cta: { label: 'Shop now', href: '/category/all' },
  },
  {
    id: 'hero-2',
    title: 'Upgrade your everyday setup',
    subtitle: 'Performance • Reliability • Design',
    description: 'Build a faster workflow with laptops, monitors, peripherals, and accessories made to last.',
    image: 'https://m.media-amazon.com/images/I/619geyiQI5L._SX3000_.jpg',
    cta: { label: 'Explore laptops', href: '/category/computers-laptops' },
  },
]

interface FuturisticHeroProps {
  slides?: FuturisticHeroSlide[]
  mobileControlsPortalTarget?: HTMLElement | null
}

export function FuturisticHero({ slides, mobileControlsPortalTarget }: FuturisticHeroProps) {
  const activeSlides = useMemo(() => (slides && slides.length > 0 ? slides : DEFAULT_SLIDES), [slides])
  const slideCount = activeSlides.length

  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    setActiveIndex(0)
  }, [slideCount])

  useEffect(() => {
    if (isPaused || slideCount <= 1) return

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount)
    }, 7000)

    return () => clearInterval(interval)
  }, [isPaused, slideCount])

  const current = activeSlides[activeIndex]

  const goPrev = () => {
    if (slideCount <= 1) return
    setActiveIndex((prev) => (prev - 1 + slideCount) % slideCount)
  }

  const goNext = () => {
    if (slideCount <= 1) return
    setActiveIndex((prev) => (prev + 1) % slideCount)
  }

  const mobileControls =
    slideCount > 1 ? (
      <div className="sm:hidden flex justify-center">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-2.5 py-2 backdrop-blur">
          <button
            type="button"
            className="grid place-items-center h-9 w-9 rounded-md bg-white/10 hover:bg-white/15 text-white cursor-pointer transition-[transform,background-color] active:translate-y-px active:scale-[0.99]"
            onClick={goPrev}
            aria-label="Previous banner"
          >
            <CaretLeft size={18} weight="bold" />
          </button>

          <div className="flex items-center gap-1.5 px-1">
            {activeSlides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  idx === activeIndex ? 'bg-primary' : 'bg-white/30 hover:bg-white/45'
                )}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            className="grid place-items-center h-9 w-9 rounded-md bg-white/10 hover:bg-white/15 text-white cursor-pointer transition-[transform,background-color] active:translate-y-px active:scale-[0.99]"
            onClick={goNext}
            aria-label="Next banner"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    ) : null

  return (
    <section
      className="relative overflow-hidden bg-[color:var(--color-background)]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-0"
          aria-hidden="true"
          drag={slideCount > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.22}
          dragDirectionLock
          onDragStart={() => setIsPaused(true)}
          onDragEnd={(_, info) => {
            setIsPaused(false)
            if (slideCount <= 1) return
            const swipeThreshold = 55
            if (info.offset.x > swipeThreshold) goPrev()
            else if (info.offset.x < -swipeThreshold) goNext()
          }}
          style={{ touchAction: 'pan-y' }}
        >
          <motion.img
            src={current.image}
            alt=""
            className={cn(
              'h-full w-full object-cover object-center sm:object-[50%_0%]',
              'brightness-[0.92] contrast-[1.06] saturate-[0.98]',
              'dark:brightness-[0.78] dark:contrast-[1.08] dark:saturate-[0.95]'
            )}
            initial={{ scale: 1.03 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 sm:h-64 bg-gradient-to-b from-transparent via-background/25 to-background" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
        <div className="relative h-[clamp(240px,40vh,460px)] sm:h-[clamp(360px,56vh,620px)]">
          {slideCount > 1 ? (
            <div className="hidden sm:flex lg:hidden absolute left-4 sm:left-6 top-4 sm:top-6 z-20 items-center gap-2.5 rounded-md border border-white/10 bg-black/25 px-3 py-2 backdrop-blur">
              <div className="text-xs text-white/70 tabular-nums">
                {activeIndex + 1}/{slideCount}
              </div>
              <div className="flex items-center gap-1.5">
                {activeSlides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      'h-2 w-2 rounded-full transition-colors',
                      idx === activeIndex ? 'bg-primary' : 'bg-white/30 hover:bg-white/45'
                    )}
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {slideCount > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'hidden sm:flex lg:hidden',
                  'absolute left-0 sm:-left-2 top-[40%] -translate-y-1/2',
                  'h-12 w-12 rounded-lg bg-background/35 hover:bg-background/55',
                  'border border-border/60 shadow-sm z-20'
                )}
                onClick={goPrev}
                aria-label="Previous banner"
              >
                <CaretLeft size={20} weight="bold" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'hidden sm:flex lg:hidden',
                  'absolute right-0 sm:-right-2 top-[40%] -translate-y-1/2',
                  'h-12 w-12 rounded-lg bg-background/35 hover:bg-background/55',
                  'border border-border/60 shadow-sm z-20'
                )}
                onClick={goNext}
                aria-label="Next banner"
              >
                <CaretRight size={20} weight="bold" />
              </Button>

              {mobileControlsPortalTarget
                ? mobileControls
                  ? createPortal(mobileControls, mobileControlsPortalTarget)
                  : null
                : mobileControls
                  ? <div className="absolute inset-x-0 bottom-4 z-20">{mobileControls}</div>
                  : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
