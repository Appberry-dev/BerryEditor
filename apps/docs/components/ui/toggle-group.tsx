'use client'

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/utils'

export const ToggleGroup = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(function ToggleGroup({ className, ...props }, ref) {
  return <ToggleGroupPrimitive.Root ref={ref} className={cn('ui-toggle-group', className)} {...props} />
})

export const ToggleGroupItem = forwardRef<
  ElementRef<typeof ToggleGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(function ToggleGroupItem({ className, ...props }, ref) {
  return <ToggleGroupPrimitive.Item ref={ref} className={cn('ui-toggle-group-item', className)} {...props} />
})