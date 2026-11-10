import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 border-2 px-1.5 py-0.5 font-pixel text-[.78rem] uppercase leading-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        default: 'border-input bg-primary text-primary-foreground',
        secondary: 'border-input bg-secondary text-secondary-foreground',
        coral: 'border-input bg-bulb text-bulb-foreground',
        bulb: 'border-input bg-bulb text-bulb-foreground',
        board: 'border-input bg-board text-bulb',
        destructive: 'border-input bg-destructive text-destructive-foreground',
        outline: 'border-input bg-popover text-popover-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
