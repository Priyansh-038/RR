import React from "react";
import { cn } from "@/lib/utils";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function PixelButton({ 
  className, 
  variant = "primary", 
  size = "md", 
  isLoading,
  children,
  disabled,
  ...props 
}: PixelButtonProps) {
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]",
    outline: "bg-transparent border-4 border-muted text-foreground hover:bg-muted/20 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]"
  };

  const sizes = {
    sm: "px-3 py-2 text-[10px]",
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-sm"
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "pixel-btn relative active:translate-y-[4px] active:shadow-none transition-all duration-75",
        variants[variant],
        sizes[size],
        disabled && "opacity-50 cursor-not-allowed active:translate-y-0 active:shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="animate-pulse">LOADING...</span>
        </span>
      ) : children}
    </button>
  );
}
