import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, CaretLeft, CaretRight, Lightning, Sparkle, GameController } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface HeroSlide {
  id: string
  title: string
  subtitle: string
  description: string
  image: string
  cta: {
    label: string
    href: string
  }
  secondaryCta?: {
    label: string
    href: string
  }
  badge?: string
  badgeColor?: string
  gradient: string
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: '1',
    title: 'DOMINATE THE GAME',
    subtitle: 'RTX 50 Series GPUs',
    description: 'Experience ray tracing at 240fps. Ultra-realistic graphics. Zero compromise.',
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=90',
    cta: { label: 'Unleash Power', href: '/category/gaming' },
    secondaryCta: { label: 'View Specs', href: '/category/gaming' },
    badge: 'JUST DROPPED',
    badgeColor: 'from-neon-green to-success',
    gradient: 'from-gamer-purple via-electric-blue to-cyber-cyan',
  },
  {
    id: '2',
    title: 'ULTRABOOKS REDEFINED',
    subtitle: 'Galaxy Pro X Series',
    description: '8K OLED • 32GB RAM • Intel i9 14th Gen • All-day battery life',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1600&q=90',
    cta: { label: 'Explore Power', href: '/category/computers-laptops' },
    secondaryCta: { label: 'Compare Models', href: '/category/computers-laptops' },
    badge: 'BESTSELLER',
    badgeColor: 'from-hot-pink to-accent',
    gradient: 'from-primary via-electric-blue to-cyan-500',
  },
  {
    id: '3',
    title: 'SOUND PERFECTED',
    subtitle: 'ProSound Elite ANC',
    description: 'Studio-grade audio • Adaptive ANC • 60hr battery • Spatial audio',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&q=90',
    cta: { label: 'Feel The Beat', href: '/category/audio-headphones' },
    secondaryCta: { label: 'Listen Now', href: '/category/audio-headphones' },
    badge: 'SAVE 30%',
    badgeColor: 'from-amber-500 to-orange-500',
    gradient: 'from-orange-500 via-hot-pink to-accent',
  },
  {
    id: '4',
    title: 'SMART HOME EVOLVED',
    subtitle: 'AI-Powered Ecosystem',
    description: 'Voice control • Energy efficient • Seamless automation • Total control',
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=1600&q=90',
    cta: { label: 'Get Smart', href: '/category/smart-home' },
    secondaryCta: { label: 'See Products', href: '/category/smart-home' },
    badge: 'NEW TECH',
    badgeColor: 'from-cyber-cyan to-electric-blue',
    gradient: 'from-cyan-500 via-blue-500 to-primary',
  },
  {
    id: '5',
    title: 'CAPTURE PERFECTION',
    subtitle: 'Pro Camera Systems',
    description: '108MP sensor • 8K video • Night mode Pro • Professional optics',
    image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1600&q=90',
    cta: { label: 'Shoot Pro', href: '/category/cameras-photography' },
    secondaryCta: { label: 'View Gallery', href: '/category/cameras-photography' },
    badge: 'PRO SERIES',
    badgeColor: 'from-gamer-purple to-hot-pink',
    gradient: 'from-purple-600 via-pink-500 to-red-500',
    thumb: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80',
  },
]

export function HeroCarousel({ slides }: { slides?: HeroSlide[] }) {
  const activeSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState(0)
  const [showControls, setShowControls] = useState(false)
  const slideCount = activeSlides.length

  useEffect(() => {
    setCurrentIndex(0)
  }, [slideCount])

  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setDirection(1)
      setCurrentIndex((prev) => (prev + 1) % slideCount)
    }, 6000)

    return () => clearInterval(interval)
  }, [isPaused, slideCount])

  const goToPrevious = () => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + slideCount) % slideCount)
  }

  const goToNext = () => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % slideCount)
  }

  const currentSlide = activeSlides[currentIndex]

  return (
    <div
      className="relative w-full h-[450px] sm:h-[550px] lg:h-[600px] overflow-hidden group"
      onMouseEnter={() => {
        setIsPaused(true)
        setShowControls(true)
      }}
      onMouseLeave={() => {
        setIsPaused(false)
        setShowControls(false)
      }}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentSlide.id}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 1000 : -1000 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -1000 : 1000 }}
          transition={{ 
            duration: 0.7, 
            ease: [0.32, 0.72, 0, 1]
          }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0">
            <motion.img
              src={currentSlide.image}
              alt={currentSlide.title}
              className="w-full h-full object-cover"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 7 }}
            />
            <div className={cn(
              'absolute inset-0 bg-gradient-to-r',
              'from-background/95 via-background/85 sm:via-background/80 to-background/60 sm:to-transparent'
            )} />
            
            <div className={cn(
              'absolute inset-0 bg-gradient-to-br mix-blend-overlay opacity-20',
              currentSlide.gradient
            )} />

            <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-t from-background to-transparent" />
          </div>

          <div className="relative h-full flex items-center">
            <div className="container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] w-full">
              <div className="grid gap-6 lg:grid-cols-[140px_1fr] items-center">
                <div className="hidden lg:flex flex-col items-center gap-3">
                  {activeSlides.slice(0, 4).map((slide, idx) => (
                    <button
                      key={slide.id}
                      onClick={() => {
                        setDirection(idx > currentIndex ? 1 : -1)
                        setCurrentIndex(idx)
                      }}
                      className={cn(
                        'w-24 h-24 rounded-xl overflow-hidden border transition-all shadow-sm',
                        idx === currentIndex
                          ? 'border-primary ring-2 ring-primary/40 scale-105'
                          : 'border-border hover:border-primary/40 hover:scale-[1.02]'
                      )}
                    >
                      <img
                        src={slide.thumb || slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                <div className="max-w-xl lg:max-w-2xl space-y-4 sm:space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="flex flex-wrap items-center gap-2 sm:gap-3"
                >
                  {currentSlide.badge && (
                    <Badge className={cn(
                      'text-xs font-black px-3 py-1.5 shadow-lg bg-gradient-to-r text-white border-0 uppercase tracking-wide',
                      currentSlide.badgeColor
                    )}>
                      <Lightning size={12} weight="fill" className="mr-1.5" />
                      {currentSlide.badge}
                    </Badge>
                  )}
                  <Sparkle size={18} weight="fill" className="text-accent animate-pulse" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  <h2 
                    className="text-xs sm:text-sm font-bold text-primary mb-2 uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {currentSlide.subtitle}
                  </h2>
                  <h1
                    className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.95] bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {currentSlide.title}
                  </h1>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-sm sm:text-lg text-foreground/90 max-w-xl font-medium leading-relaxed"
                >
                  {currentSlide.description}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="flex flex-wrap gap-3 pt-2"
                >
                  <Button 
                    size="lg" 
                    className="gap-2 h-11 sm:h-12 px-5 sm:px-8 text-sm sm:text-base font-bold shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-electric-blue" 
                    asChild
                  >
                    <Link href={currentSlide.cta.href}>
                      {currentSlide.cta.label}
                      <ArrowRight size={18} weight="bold" />
                    </Link>
                  </Button>
                  {currentSlide.secondaryCta && (
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="gap-2 h-11 sm:h-12 px-5 sm:px-8 text-sm sm:text-base font-semibold border-2 hover:bg-primary/10 hover:border-primary hover:scale-105 transition-all duration-300" 
                      asChild
                    >
                      <Link href={currentSlide.secondaryCta.href}>
                        {currentSlide.secondaryCta.label}
                      </Link>
                    </Button>
                  )}
                </motion.div>
              </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.button
        onClick={goToPrevious}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : -20 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-background/40 backdrop-blur-xl border border-primary/30 items-center justify-center hover:bg-primary hover:border-primary text-foreground hover:text-primary-foreground transition-all duration-300 hover:scale-110 z-10 shadow-xl',
          'hidden md:flex'
        )}
        aria-label="Previous slide"
      >
        <CaretLeft size={20} weight="bold" />
      </motion.button>

      <motion.button
        onClick={goToNext}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: showControls ? 1 : 0, x: showControls ? 0 : 20 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-background/40 backdrop-blur-xl border border-primary/30 items-center justify-center hover:bg-primary hover:border-primary text-foreground hover:text-primary-foreground transition-all duration-300 hover:scale-110 z-10 shadow-xl',
          'hidden md:flex'
        )}
        aria-label="Next slide"
      >
        <CaretRight size={20} weight="bold" />
      </motion.button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-10">
        {activeSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setDirection(index > currentIndex ? 1 : -1)
              setCurrentIndex(index)
            }}
            className={cn(
              'h-1.5 sm:h-2 rounded-full transition-all duration-500 hover:scale-110',
              index === currentIndex
                ? 'w-8 sm:w-10 bg-gradient-to-r from-primary via-accent to-cyber-cyan shadow-lg shadow-primary/50'
                : 'w-1.5 sm:w-2 bg-background/50 backdrop-blur-sm hover:bg-background/70 border border-primary/30'
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <div className="absolute bottom-6 right-4 sm:right-6 z-10 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/40 backdrop-blur-xl border border-primary/20">
        <GameController size={16} weight="bold" className="text-primary" />
        <span className="text-xs font-semibold text-foreground">
          {currentIndex + 1} / {slideCount}
        </span>
      </div>
    </div>
  )
}
