'use client'

import { Command as CommandPrimitive } from 'cmdk'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '../../lib/utils'

export const Command = forwardRef<ElementRef<typeof CommandPrimitive>, ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  function Command({ className, ...props }, ref) {
    return <CommandPrimitive ref={ref} className={cn('ui-command', className)} {...props} />
  }
)

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
  return <CommandPrimitive.Input ref={ref} className={cn('ui-command-input', className)} {...props} />
})

export const CommandList = forwardRef<ElementRef<typeof CommandPrimitive.List>, ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  function CommandList({ className, ...props }, ref) {
    return <CommandPrimitive.List ref={ref} className={cn('ui-command-list', className)} {...props} />
  }
)

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty({ className, ...props }, ref) {
  return <CommandPrimitive.Empty ref={ref} className={cn('ui-command-empty', className)} {...props} />
})

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return <CommandPrimitive.Group ref={ref} className={cn('ui-command-group', className)} {...props} />
})

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, ...props }, ref) {
  return <CommandPrimitive.Item ref={ref} className={cn('ui-command-item', className)} {...props} />
})

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return <CommandPrimitive.Separator ref={ref} className={cn('ui-command-separator', className)} {...props} />
})