import { Link } from "wouter";
import { PixelCard } from "@/components/PixelCard";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <PixelCard className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="w-16 h-16 text-destructive animate-bounce" />
        </div>
        <h1 className="text-4xl font-display text-primary">404</h1>
        <p className="text-xl font-body text-muted-foreground">
          You've wandered into the void. This dungeon level does not exist.
        </p>
        <div className="pt-6">
          <Link href="/" className="text-accent hover:underline font-display text-sm uppercase">
            Return to Entrance
          </Link>
        </div>
      </PixelCard>
    </div>
  );
}
