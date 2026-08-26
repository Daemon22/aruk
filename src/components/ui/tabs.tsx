"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-xl bg-muted/30 p-1.5 text-muted-foreground",
      "border border-border/30 dark:border-border/15",
      "backdrop-blur-md",
      "transition-colors duration-300",
      "shadow-sm shadow-black/[0.03] dark:shadow-black/10",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
      "transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-muted-foreground hover:text-foreground/70 hover:bg-muted/30",
      "relative",
      /* Animated pill indicator */
      "before:absolute before:bottom-0 before:left-1/2 before:-translate-x-1/2 before:w-0 before:h-[2.5px] before:rounded-full",
      "before:bg-gradient-to-r before:from-brand before:to-brand-light",
      "before:transition-all before:duration-350 before:ease-out",
      "before:shadow-[0_0_8px_var(--glow)]",
      /* Active state */
      "data-[state=active]:text-foreground data-[state=active]:bg-background/95 data-[state=active]:shadow-sm",
      "data-[state=active]:before:w-6",
      "data-[state=active]:dark:bg-card/80 data-[state=active]:dark:shadow-black/10",
      /* Icon color on active */
      "data-[state=active]:[&>svg]:text-brand data-[state=active]:[&>svg]:drop-shadow-[0_0_4px_var(--glow)]",
      /* Hover micro-animation on icon */
      "[&>svg]:transition-all [&>svg]:duration-300 hover:[&>svg]:scale-110",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "animate-fade-in-up",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
