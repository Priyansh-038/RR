import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { PixelButton } from "@/components/PixelButton";
import { PixelCard } from "@/components/PixelCard";
import { useJoinRoom } from "@/hooks/use-room";
import { ArrowLeft, Sword } from "lucide-react";

export default function Join() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const joinRoom = useJoinRoom();
  
  // Extract code from query string "?code=ABCD"
  const urlParams = new URLSearchParams(search);
  const codeParam = urlParams.get("code") || "";

  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!name) {
      setError("Enter a name, hero!");
      return;
    }
    try {
      await joinRoom.mutateAsync({ code: codeParam, name });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        
        <button 
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-display text-xs mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <PixelCard title={`Join Room: ${codeParam}`} className="space-y-6 backdrop-blur-sm bg-black/40">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase text-muted-foreground mb-2 block font-display">Who goes there?</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter Hero Name"
                autoFocus
                className="w-full bg-black/50 border-2 border-muted p-3 text-lg focus:border-primary focus:outline-none focus:ring-0 font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm font-body bg-destructive/10 p-2 border border-destructive/50 text-center animate-shake">
                {error}
              </p>
            )}

            <PixelButton 
              className="w-full" 
              onClick={handleJoin}
              disabled={joinRoom.isPending}
              isLoading={joinRoom.isPending}
            >
              <Sword className="w-4 h-4 mr-2" />
              Join Party
            </PixelButton>
          </div>
        </PixelCard>
      </div>
    </div>
  );
}
