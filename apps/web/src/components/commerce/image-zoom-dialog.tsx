import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageZoomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<{ id: string; url: string; alt: string }>
  initialIndex: number
}

export function ImageZoomDialog({
  open,
  onOpenChange,
  images,
  initialIndex,
}: ImageZoomDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-lg border-0">
        <div className="relative w-full h-[95vh] flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={() => onOpenChange(false)}
          >
            <X size={24} />
          </Button>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full flex items-center justify-center p-4"
            >
              <img
                src={images[currentIndex]?.url}
                alt={images[currentIndex]?.alt}
                className="max-w-full max-h-full object-contain"
              />
            </motion.div>
          </AnimatePresence>

          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={handlePrevious}
              >
                <CaretLeft size={24} weight="bold" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
                onClick={handleNext}
              >
                <CaretRight size={24} weight="bold" />
              </Button>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      index === currentIndex
                        ? 'bg-primary w-6'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    )}
                  />
                ))}
              </div>

              <div className="absolute bottom-6 right-6 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
