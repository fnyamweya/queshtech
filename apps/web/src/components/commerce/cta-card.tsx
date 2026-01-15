import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Icon } from '@phosphor-icons/react'

interface CTACardProps {
  icon: Icon
  title: string
  description: string
  iconBg: string
  iconColor: string
  delay?: number
}

export function CTACard({
  icon: IconComponent,
  title,
  description,
  iconBg,
  iconColor,
  delay = 0,
}: CTACardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
    >
      <Card
        className={cn(
          'group relative overflow-hidden p-4 sm:p-5 text-center transition-all duration-300',
          'border hover:border-primary/50 cursor-pointer hover:shadow-xl bg-card'
        )}
      >
        <motion.div
          className="relative z-10"
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <div className={cn(
            'relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg mb-3',
            'transition-all duration-300 group-hover:scale-110',
            iconBg
          )}>
            <IconComponent size={24} weight="bold" className={cn(iconColor, 'relative z-10')} />
          </div>
          
          <h3 className="font-bold text-sm sm:text-base mb-1" 
            style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h3>
          <p className="text-xs text-muted-foreground leading-tight">
            {description}
          </p>
        </motion.div>
        
        <div className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          'bg-gradient-to-br from-transparent via-transparent to-primary/5'
        )} />
      </Card>
    </motion.div>
  )
}
