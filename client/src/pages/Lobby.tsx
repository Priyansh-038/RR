import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGameSocket } from "@/hooks/use-game-socket";
import { PixelButton } from "@/components/PixelButton";
import { PixelCard } from "@/components/PixelCard";
import { RoleCard } from "@/components/RoleCard";
import { GameCanvas } from "@/components/GameCanvas";
import { ROLES } from "@shared/schema";
import { Copy, Crown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Lobby() {
  const [, params] = useRoute("/lobby/:code");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const sessionData = JSON.parse(localStorage.getItem("dungeon_session") || "{}");

  if (!sessionData.code || sessionData.code !== params?.code) {
    setTimeout(() => setLocation("/"), 0);
    return null;
  }

  const { isConnected, players, room, gameState, selectRole, toggleReady, startGame, sendInput } = useGameSocket({
    code: params?.code || "",
    name: sessionData.name,
    sessionId: sessionData.sessionId,
  });

  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (!params?.code) return;
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    toast({ title: "Code Copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const myPlayer = players.find((p) => p.sessionId === sessionData.sessionId);
  const isHost = myPlayer?.isHost;
  const isGamePlaying = room?.status === "playing";
  const selectedRoles = new Set(players.map((p) => p.role).filter(Boolean));
  const everyoneReady = players.length > 0 && players.every((p) => p.isReady);

  if (isGamePlaying && gameState) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-4 left-4 z-10 text-white font-display text-shadow">
          <div className="flex items-center gap-4">
            <div className="bg-black/50 p-2 rounded border-2 border-white/20">STAGE: {gameState.phase.toUpperCase()}</div>
            <div className="bg-black/50 p-2 rounded border-2 border-white/20">WAVE {gameState.wave}</div>
            {myPlayer && (
              <div className="bg-black/50 p-2 rounded border-2 border-white/20">
                HP: {Math.round(gameState.players.find((p) => p.id === myPlayer.id)?.health || 0)}
              </div>
            )}
          </div>
        </div>

        <GameCanvas gameState={gameState} myPlayerId={myPlayer?.id} onInput={sendInput} />

        <div className="absolute bottom-4 text-white/50 text-xs font-body">WASD to Move • SPACE/Mouse to Attack • Touch the dungeon door to enter</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl text-primary mb-1">Dungeon Lobby</h1>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-body">ROOM CODE:</span>
            <button
              onClick={copyCode}
              className="bg-muted px-3 py-1 rounded border border-border flex items-center gap-2 hover:bg-muted/80 transition-colors text-white font-mono"
            >
              {params?.code}
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-red-500 animate-pulse"}`} />
          <span className="text-xs font-display text-muted-foreground">{isConnected ? "CONNECTED" : "CONNECTING..."}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          <PixelCard title={`Party (${players.length}/5)`} className="h-full">
            <div className="space-y-3">
              {players.map((p) => (
                <div key={p.id} className={`flex items-center justify-between p-3 border-2 ${p.isReady ? "border-green-500/50 bg-green-500/10" : "border-muted bg-black/20"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded flex items-center justify-center font-display text-xs">{p.role ? p.role[0].toUpperCase() : "?"}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs">{p.name}</span>
                        {p.isHost && <Crown className="w-3 h-3 text-yellow-500" />}
                      </div>
                      <span className="text-xs text-muted-foreground uppercase">{p.role || "No Role"}</span>
                    </div>
                  </div>
                  {p.isReady && <Check className="w-4 h-4 text-green-500" />}
                </div>
              ))}

              {Array.from({ length: Math.max(0, 5 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="p-3 border-2 border-dashed border-muted/30 text-muted-foreground/30 text-center text-sm font-display">
                  Empty Slot
                </div>
              ))}
            </div>
          </PixelCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <PixelCard title="Choose Class (Unique per player)">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ROLES.map((role) => {
                const takenBySomeoneElse = selectedRoles.has(role) && myPlayer?.role !== role;
                return (
                  <RoleCard
                    key={role}
                    role={role}
                    isSelected={myPlayer?.role === role}
                    onSelect={() => selectRole(role)}
                    disabled={!!myPlayer?.isReady || takenBySomeoneElse}
                  />
                );
              })}
            </div>
          </PixelCard>

          <div className="flex flex-col md:flex-row gap-4 justify-end items-center border-t-4 border-muted/30 pt-6">
            <div className="text-sm text-muted-foreground font-body mr-auto">
              {!myPlayer?.role && "Select a unique role to ready up."}
              {myPlayer?.role && !myPlayer.isReady && "Ready up when you are set."}
              {myPlayer?.isReady && !everyoneReady && "Waiting for all players to be ready..."}
              {everyoneReady && "All players ready. Game starts automatically!"}
            </div>

            <PixelButton
              variant={myPlayer?.isReady ? "outline" : "primary"}
              onClick={() => toggleReady(!myPlayer?.isReady)}
              disabled={!myPlayer?.role}
              className="w-full md:w-auto"
            >
              {myPlayer?.isReady ? "Cancel Ready" : "READY UP"}
            </PixelButton>

            {isHost && (
              <PixelButton
                variant="destructive"
                disabled={!everyoneReady || players.some((p) => !p.role)}
                onClick={startGame}
                className="w-full md:w-auto"
              >
                FORCE START
              </PixelButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
