import { useState } from "react";
import { useLocation } from "wouter";
import { PixelButton } from "@/components/PixelButton";
import { PixelCard } from "@/components/PixelCard";
import { useCreateRoom, useJoinRoom } from "@/hooks/use-room";
import { Sword, Users } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();
  
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!name || !joinCode) {
      setError("Name and Code are required!");
      return;
    }
    try {
      await joinRoom.mutateAsync({ code: joinCode, name });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCreate = () => {
    createRoom.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        
        {/* Title Block */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl text-primary drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-pulse">
            DUNGEON RAID
          </h1>
          <p className="text-xl text-muted-foreground font-body">
            Retro 5-Player Co-op Adventure
          </p>
        </div>

        {/* Main Action Card */}
        <PixelCard className="space-y-8 backdrop-blur-sm bg-black/40">
          
          {/* Join Section */}
          <div className="space-y-4">
            <h2 className="text-lg flex items-center gap-2">
              <Sword className="w-5 h-5 text-accent" />
              Join Party
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block font-display">Hero Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Leeroy"
                  className="w-full bg-black/50 border-2 border-muted p-3 text-lg focus:border-primary focus:outline-none focus:ring-0 font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>
              
              <div>
                <label className="text-xs uppercase text-muted-foreground mb-1 block font-display">Room Code</label>
                <input 
                  type="text" 
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex: AB12"
                  className="w-full bg-black/50 border-2 border-muted p-3 text-lg focus:border-primary focus:outline-none focus:ring-0 font-body text-foreground placeholder:text-muted-foreground/50 uppercase tracking-widest transition-colors"
                />
              </div>
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
              Enter Dungeon
            </PixelButton>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-display">Or</span>
            </div>
          </div>

          {/* Create Section */}
          <div className="text-center">
             <PixelButton 
              variant="secondary" 
              className="w-full"
              onClick={handleCreate}
              disabled={createRoom.isPending}
              isLoading={createRoom.isPending}
            >
              <Users className="w-4 h-4 mr-2" />
              Start New Raid
            </PixelButton>
          </div>

        </PixelCard>
        
        <p className="text-center text-muted-foreground text-sm opacity-50 font-body">
          v1.0.0 • No Account Required
        </p>
      </div>
    </div>
  );
}
