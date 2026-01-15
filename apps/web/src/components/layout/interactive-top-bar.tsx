import { useState, useEffect } from 'react'
import { X, Lightning, Percent, Gift, Timer } from '@phosphor-icons/react'
import { Link } from 'wouter'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface TopBarMessage {
  id: string
  text: string
  link?: string
  icon?: 'lightning' | 'percent' | 'gift' | 'timer'
  color?: string
}

const messages: TopBarMessage[] = [
  {
    id: '1',
    text: '🎉 Flash Sale: Up to 40% Off Gaming Gear • Ends in 2 hours',
    link: '/category/gaming',
    icon: 'lightning',
    color: 'from-neon-green to-success'
  },
  {
    id: '2',
    text: '✨ Free Shipping on Orders Over KES 10,000 • No Code Needed',
    link: '/',
    icon: 'gift',
    color: 'from-primary to-electric-blue'
  },
  {
    id: '3',
    text: '🔥 New Arrivals: Latest Tech Just Dropped • Shop Now',
    link: '/',
    icon: 'percent',
    color: 'from-hot-pink to-accent'
  },
  {
    id: '4',
    text: '⚡ Same-Day Delivery Available in Nairobi • Order by 2PM',
    link: '/',
    icon: 'timer',
    color: 'from-cyber-cyan to-electric-blue'
  },
]

const iconMap = {
  lightning: Lightning,
  percent: Percent,
  gift: Gift,
  timer: Timer,
}

export function InteractiveTopBar() {
  const [isVisible, setIsVisible] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!isVisible) return
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  const currentMessage = messages[currentIndex]
  const Icon = currentMessage.icon ? iconMap[currentMessage.icon] : Lightning

  return (
    <div
      className={cn('relative w-full py-2 overflow-hidden shadow-sm')}
      style={{
        background: 'linear-gradient(90deg, #0A1A2F 0%, #1A73E8 100%)',
      }}
    >
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-10 max-w-[1400px] text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessage.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2"
              >
                <Icon size={16} weight="bold" className="text-white shrink-0 hidden sm:block" />
                {currentMessage.link ? (
                  <Link href={currentMessage.link}>
                    <span className="text-xs sm:text-sm font-semibold text-white hover:underline cursor-pointer truncate">
                      {currentMessage.text}
                    </span>
                  </Link>
                ) : (
                  <span className="text-xs sm:text-sm font-semibold text-white truncate">
                    {currentMessage.text}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className="shrink-0 w-5 h-5 rounded-sm bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors group"
            aria-label="Close banner"
          >
            <X size={12} weight="bold" className="text-white" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 mt-1.5">
          {messages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'h-0.5 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'w-4 bg-white'
                  : 'w-1.5 bg-white/40 hover:bg-white/60'
              )}
              aria-label={`Go to message ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
