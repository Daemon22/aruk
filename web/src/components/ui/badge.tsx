import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand/10 text-brand dark:bg-brand/15 dark:text-brand-light",
        secondary:
          "border-transparent bg-accent text-accent-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/15",
        outline:
          "border-border/60 dark:border-border/40 text-muted-foreground",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-400/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }