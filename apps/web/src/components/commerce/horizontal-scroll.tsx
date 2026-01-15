import { ReactNode, useRef } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HorizontalScrollProps {
  children: ReactNode
  className?: string
  showControls?: boolean
}

export function HorizontalScroll({ children, className, showControls = true }: HorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 400
      const newPosition =
        scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount)
      scrollRef.current.scrollTo({ left: newPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="relative group">
      {showControls && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/95 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <CaretLeft size={20} weight="bold" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/95 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <CaretRight size={20} weight="bold" />
          </Button>
        </>
      )}
      <div
        ref={scrollRef}
        className={cn(
          'flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth',
          '[&>*]:w-[180px] [&>*]:sm:w-[200px] [&>*]:flex-shrink-0',
          className
        )}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>
  )
}
