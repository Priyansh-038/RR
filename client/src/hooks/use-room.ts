import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useLocation } from "wouter";

// Create Room
export function useCreateRoom() {
  const [, setLocation] = useLocation();
  
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.rooms.create.path, {
        method: api.rooms.create.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create room");
      return api.rooms.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      // Store roomId temporarily if needed, but mainly we just nav to the lobby
      // We pass the code to the join screen or auto-join logic could handle it
      // For now, let's redirect to join with the code pre-filled
      setLocation(`/join?code=${data.code}`);
    },
  });
}

// Join Room
export function useJoinRoom() {
  const [, setLocation] = useLocation();
  
  return useMutation({
    mutationFn: async (data: { code: string; name: string }) => {
      const validated = api.rooms.join.input.parse(data);
      const res = await fetch(api.rooms.join.path, {
        method: api.rooms.join.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Room not found");
        }
        throw new Error("Failed to join room");
      }
      
      return api.rooms.join.responses[200].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      // Save session info to local storage for reconnection resilience
      localStorage.setItem("dungeon_session", JSON.stringify({
        roomId: data.roomId,
        sessionId: data.sessionId,
        playerId: data.playerId,
        code: variables.code,
        name: variables.name
      }));
      setLocation(`/lobby/${variables.code}`);
    },
  });
}

// Get Room Info (for lobby state)
export function useRoom(code: string) {
  return useQuery({
    queryKey: [api.rooms.get.path, code],
    queryFn: async () => {
      const url = buildUrl(api.rooms.get.path, { code });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch room info");
      return api.rooms.get.responses[200].parse(await res.json());
    },
    enabled: !!code,
  });
}
