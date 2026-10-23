'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/lib/utils';

/** Pixel bar: stepped blocks, no smooth fill. `tone` picks the block color. */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    tone?: 'grass' | 'bulb' | 'red';
  }
>(({ className, value, tone = 'grass', ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    data-tone={tone}
    className={cn('bar-px w-full overflow-hidden', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
