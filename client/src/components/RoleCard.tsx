import { cn } from "@/lib/utils";
import { Role } from "@shared/schema";
import { Sword, Shield, Crosshair, Zap, Heart } from "lucide-react";

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function RoleCard({ role, isSelected, onSelect, disabled }: RoleCardProps) {
  const config = {
    swordsman: { icon: Sword, color: "text-blue-500", desc: "Tanky melee fighter" },
    beast: { icon: Shield, color: "text-purple-500", desc: "Fast berserker" },
    archer: { icon: Crosshair, color: "text-green-500", desc: "Ranged physical" },
    mage: { icon: Zap, color: "text-cyan-500", desc: "Area magic damage" },
    healer: { icon: Heart, color: "text-yellow-500", desc: "Support specialist" },
  }[role];

  const Icon = config.icon;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center p-4 border-4 transition-all duration-200 w-full",
        isSelected 
          ? "border-primary bg-primary/10 -translate-y-2 shadow-[0_8px_0_0_hsl(var(--primary))]" 
          : "border-muted bg-card hover:border-muted-foreground hover:-translate-y-1 hover:shadow-[0_4px_0_0_hsl(var(--muted-foreground))]",
        disabled && "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none"
      )}
    >
      <div className={cn("p-3 rounded-full mb-3 bg-black/20", config.color)}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="font-display uppercase text-sm mb-1">{role}</h3>
      <p className="text-xs text-muted-foreground font-body text-center leading-tight">{config.desc}</p>
    </button>
  );
}
