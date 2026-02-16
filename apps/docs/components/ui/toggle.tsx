'use client'

import * as TogglePrimitive from '@radix-ui/react-toggle'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/utils'

export const Toggle = forwardRef<
  ElementRef<typeof TogglePrimitive.Root>,
  ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(function Toggle({ className, ...props }, ref) {
  return (
    <TogglePrimitive.Root
      ref={ref}
      className={cn('ui-toggle', className)}
      {...props}
    />
  )
})