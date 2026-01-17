import { useEffect, useMemo, useState } from 'react'
import { Link } from 'wouter'
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
}

export function FuturisticHero({ slides }: FuturisticHeroProps) {
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
        >
          <motion.img
            src={current.image}
            alt=""
            className={cn(
              'h-full w-full object-cover',
              'brightness-[0.78] contrast-[1.08] saturate-[0.92]',
              'dark:brightness-[0.58] dark:contrast-[1.1] dark:saturate-[0.95]'
            )}
            initial={{ scale: 1.03 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/10 to-background/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/10 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-b from-transparent via-background/35 to-background" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px]">
        <div className="relative pt-10 sm:pt-14 lg:pt-16 pb-28 min-h-[420px] sm:min-h-[520px] lg:min-h-[560px]">
          <Link
            href={current.cta.href}
            className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`${current.cta.label}: ${current.title}`}
            title={`${current.cta.label}: ${current.title}`}
          />
          <div className="sr-only">
            <div>{current.subtitle}</div>
            <div>{current.title}</div>
            <div>{current.description}</div>
          </div>

          {slideCount > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  'hidden sm:flex',
                  'absolute left-0 sm:-left-2 top-1/2 -translate-y-1/2',
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
                  'hidden sm:flex',
                  'absolute right-0 sm:-right-2 top-1/2 -translate-y-1/2',
                  'h-12 w-12 rounded-lg bg-background/35 hover:bg-background/55',
                  'border border-border/60 shadow-sm z-20'
                )}
                onClick={goNext}
                aria-label="Next banner"
              >
                <CaretRight size={20} weight="bold" />
              </Button>

              <div className="relative z-20 mt-6 flex items-center justify-between sm:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full bg-background/70"
                  onClick={goPrev}
                  aria-label="Previous banner"
                >
                  <CaretLeft size={18} weight="bold" />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full bg-background/70"
                  onClick={goNext}
                  aria-label="Next banner"
                >
                  Next
                  <CaretRight size={18} weight="bold" />
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
