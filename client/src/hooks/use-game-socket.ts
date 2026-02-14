import { useEffect, useRef, useState, useCallback } from "react";
import { 
  type WsMessage, 
  type ServerMessage, 
  type GameState, 
  type Role,
  type Player,
  type Room
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface UseGameSocketProps {
  code: string;
  name: string;
  sessionId?: string;
  onGameStart?: () => void;
}

export function useGameSocket({ code, name, sessionId, onGameStart }: UseGameSocketProps) {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      // Join room immediately on connect
      sendMessage({ type: "join", payload: { code, name, sessionId } });
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setError("Connection error");
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        
        switch (msg.type) {
          case "room_update":
            setPlayers(msg.payload.players);
            setRoom(msg.payload.room);
            if (msg.payload.room.status === "playing" && onGameStart) {
              onGameStart();
            }
            break;
            
          case "game_state":
            setGameState(msg.payload);
            break;
            
          case "error":
            toast({
              title: "Error",
              description: msg.payload.message,
              variant: "destructive",
            });
            break;
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };
  }, [code, name, sessionId, onGameStart, toast]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = (msg: WsMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  };

  const selectRole = (role: Role) => {
    sendMessage({ type: "select_role", payload: { role } });
  };

  const toggleReady = (isReady: boolean) => {
    sendMessage({ type: "ready", payload: { isReady } });
  };

  const startGame = () => {
    sendMessage({ type: "start_game" });
  };

  const sendInput = (x: number, y: number, attack: boolean) => {
    sendMessage({ type: "input", payload: { x, y, attack } });
  };

  return {
    isConnected,
    error,
    players,
    room,
    gameState,
    selectRole,
    toggleReady,
    startGame,
    sendInput
  };
}
