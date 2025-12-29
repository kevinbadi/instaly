import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-neon-sm hover:shadow-neon",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-silver-700 bg-transparent text-silver-300 hover:border-neon-500 hover:text-neon-400 hover:bg-neon-500/5",
        secondary:
          "bg-dark-400 text-silver-300 hover:bg-dark-300 hover:text-silver-100 border border-silver-800",
        ghost: 
          "hover:bg-dark-400 hover:text-silver-100 text-silver-400",
        link: 
          "text-neon-400 underline-offset-4 hover:underline hover:text-neon-300",
        gradient:
          "neon-gradient-bg text-black font-bold hover:opacity-90 shadow-neon hover:shadow-neon-lg button-shine",
        silver:
          "bg-silver-gradient text-dark-900 font-bold hover:opacity-90 shadow-silver",
        neon:
          "bg-neon-500 text-black font-bold hover:bg-neon-400 shadow-neon-sm hover:shadow-neon",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
