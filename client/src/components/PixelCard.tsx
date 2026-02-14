import React from "react";
import { cn } from "@/lib/utils";

interface PixelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  variant?: "default" | "primary" | "dark";
}

export function PixelCard({ 
  className, 
  title, 
  children, 
  variant = "default",
  ...props 
}: PixelCardProps) {
  const bgColors = {
    default: "bg-card border-border",
    primary: "bg-primary/10 border-primary",
    dark: "bg-black/40 border-border"
  };

  return (
    <div 
      className={cn(
        "relative p-6 border-4 shadow-[8px_8px_0_0_rgba(0,0,0,0.3)]",
        bgColors[variant],
        className
      )} 
      {...props}
    >
      {/* Corner decorations for that extra retro feel */}
      <div className="absolute top-0 left-0 w-2 h-2 bg-current opacity-50" />
      <div className="absolute top-0 right-0 w-2 h-2 bg-current opacity-50" />
      <div className="absolute bottom-0 left-0 w-2 h-2 bg-current opacity-50" />
      <div className="absolute bottom-0 right-0 w-2 h-2 bg-current opacity-50" />
      
      {title && (
        <h3 className="mb-4 text-xl text-primary font-display uppercase tracking-widest text-shadow-sm">
          {title}
        </h3>
      )}
      <div className="font-body text-xl">
        {children}
      </div>
    </div>
  );
}
