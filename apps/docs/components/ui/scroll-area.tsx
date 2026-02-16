'use client'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/utils'

export const ScrollArea = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(function ScrollArea({ className, children, ...props }, ref) {
  return (
    <ScrollAreaPrimitive.Root ref={ref} className={cn('ui-scroll-area', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="ui-scroll-viewport">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})

const ScrollBar = forwardRef<
  ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(function ScrollBar({ className, orientation = 'vertical', ...props }, ref) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn('ui-scroll-bar', orientation === 'vertical' ? 'is-vertical' : 'is-horizontal', className)}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb className="ui-scroll-thumb" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
})