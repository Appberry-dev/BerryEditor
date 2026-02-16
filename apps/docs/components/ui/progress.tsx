'use client'

import * as ProgressPrimitive from '@radix-ui/react-progress'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/utils'

export const Progress = forwardRef<
  ElementRef<typeof ProgressPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { value?: number }
>(function Progress({ className, value = 0, ...props }, ref) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <ProgressPrimitive.Root ref={ref} className={cn('ui-progress', className)} value={safeValue} {...props}>
      <ProgressPrimitive.Indicator className="ui-progress-indicator" style={{ transform: `translateX(-${100 - safeValue}%)` }} />
    </ProgressPrimitive.Root>
  )
})