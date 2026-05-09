import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-tertiary disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-tertiary text-white hover:bg-tertiary/90",
        outline:
          "border border-outline-variant/25 bg-transparent text-on-surface hover:bg-surface-container-high",
        ghost:
          "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        destructive:
          "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/15",
        secondary:
          "bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
        tonal:
          "bg-primary-container text-on-primary-container hover:opacity-90",
        link: "text-tertiary underline-offset-4 hover:underline h-auto p-0",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
