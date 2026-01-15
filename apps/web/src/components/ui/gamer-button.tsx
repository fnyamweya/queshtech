import { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GamerButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const GamerButton = forwardRef<HTMLButtonElement, GamerButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    const variantStyles = {
      primary: 'bg-gradient-to-r from-primary via-electric-blue to-primary text-primary-foreground hover:shadow-primary/50',
      secondary: 'bg-gradient-to-r from-gamer-purple via-electric-blue to-gamer-purple text-white hover:shadow-gamer-purple/50',
      accent: 'bg-gradient-to-r from-accent via-hot-pink to-accent text-accent-foreground hover:shadow-accent/50',
      success: 'bg-gradient-to-r from-neon-green via-success to-neon-green text-success-foreground hover:shadow-neon-green/50',
      danger: 'bg-gradient-to-r from-destructive via-red-600 to-destructive text-destructive-foreground hover:shadow-destructive/50',
    }

    const sizeStyles = {
      sm: 'h-9 px-4 text-sm',
      md: 'h-11 px-6 text-base',
      lg: 'h-14 px-8 text-lg',
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'relative font-bold tracking-wide uppercase overflow-hidden',
          'rounded-lg transition-all duration-300',
          'shadow-lg hover:shadow-2xl',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          'before:absolute before:inset-0',
          'before:bg-gradient-to-r before:from-white/20 before:via-transparent before:to-white/20',
          'before:translate-x-[-200%] hover:before:translate-x-[200%]',
          'before:transition-transform before:duration-700',
          'after:absolute after:inset-0 after:rounded-[inherit]',
          'after:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.button>
    )
  }
)

GamerButton.displayName = 'GamerButton'
