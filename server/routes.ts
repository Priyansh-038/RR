import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { randomUUID } from "crypto";

const TICK_RATE = 20;
const ROOM_SIZE = { width: 800, height: 600 };

type GamePhase = "courtyard" | "dungeon" | "boss" | "cleared";

interface RuntimePlayerState {
  id: number;
  name: string;
  role: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  facing: "left" | "right";
  isAttacking: boolean;
}

interface RuntimeEnemyState {
  id: string;
  type: "goblin" | "orc" | "boss";
  x: number;
  y: number;
  health: number;
  maxHealth: number;
}

interface GameRoomState {
  players: Map<string, RuntimePlayerState>;
  enemies: RuntimeEnemyState[];
  projectiles: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    createdAt: number;
  }>;
  status: "waiting" | "playing" | "won" | "lost";
  wave: number;
  width: number;
  height: number;
  phase: GamePhase;
  phaseStartedAt: number;
}

interface SocketMeta {
  roomId: number;
  sessionId: string;
}

const activeGames = new Map<number, GameRoomState>();
const socketMeta = new Map<WebSocket, SocketMeta>();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.post(api.rooms.create.path, async (_req, res) => {
    const room = await storage.createRoom();
    res.status(201).json({ code: room.code, roomId: room.id });
  });

  app.post(api.rooms.join.path, async (req, res) => {
    try {
      const { code, name } = api.rooms.join.input.parse(req.body);
      const room = await storage.getRoomByCode(code);
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (room.status !== "waiting") return res.status(400).json({ message: "Game already in progress" });

      const existingPlayers = await storage.getPlayersInRoom(room.id);
      if (existingPlayers.length >= 5) return res.status(400).json({ message: "Room is full" });

      const sessionId = randomUUID();
      const player = await storage.addPlayer({
        roomId: room.id,
        name,
        sessionId,
        role: null,
        isHost: existingPlayers.length === 0,
        isReady: false,
      });

      return res.json({ roomId: room.id, sessionId, playerId: player.id });
    } catch {
      return res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get(api.rooms.get.path, async (req, res) => {
    const room = await storage.getRoomByCode(req.params.code);
    if (!room) return res.status(404).json({ message: "Room not found" });
    return res.json(room);
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "join") {
          const { code, name, sessionId: incomingSessionId } = message.payload;
          const room = await storage.getRoomByCode(code);
          if (!room) {
            ws.send(JSON.stringify({ type: "error", payload: { message: "Room not found" } }));
            return;
          }

          const players = await storage.getPlayersInRoom(room.id);
          let player = incomingSessionId
            ? players.find((p) => p.sessionId === incomingSessionId)
            : undefined;

          if (!player) {
            player = players.find((p) => p.name === name);
          }

          if (!player) {
            if (players.length >= 5) {
              ws.send(JSON.stringify({ type: "error", payload: { message: "Room is full" } }));
              return;
            }

            const newSessionId = randomUUID();
            player = await storage.addPlayer({
              roomId: room.id,
              name,
              sessionId: newSessionId,
              role: null,
              isHost: players.length === 0,
              isReady: false,
            });
          }

          socketMeta.set(ws, { roomId: room.id, sessionId: player.sessionId });
          await broadcastRoomUpdate(room.id);
          return;
        }

        const meta = socketMeta.get(ws);
        if (!meta) return;

        if (message.type === "select_role") {
          const player = await storage.getPlayerBySessionId(meta.sessionId);
          if (!player) return;

          const playersInRoom = await storage.getPlayersInRoom(meta.roomId);
          const roleTakenByOther = playersInRoom.some(
            (p) => p.role === message.payload.role && p.id !== player.id,
          );

          if (roleTakenByOther) {
            ws.send(
              JSON.stringify({ type: "error", payload: { message: "That role is already taken in this room." } }),
            );
            return;
          }

          if (player.isReady) {
            ws.send(JSON.stringify({ type: "error", payload: { message: "Unready first to switch roles." } }));
            return;
          }

          await storage.updatePlayerRole(player.id, message.payload.role);
          await broadcastRoomUpdate(meta.roomId);
          return;
        }

        if (message.type === "ready") {
          const player = await storage.getPlayerBySessionId(meta.sessionId);
          if (!player) return;

          if (message.payload.isReady && !player.role) {
            ws.send(JSON.stringify({ type: "error", payload: { message: "Choose a role first." } }));
            return;
          }

          await storage.updatePlayerReady(player.id, message.payload.isReady);
          await broadcastRoomUpdate(meta.roomId);
          await maybeStartGame(meta.roomId);
          return;
        }

        if (message.type === "start_game") {
          await maybeStartGame(meta.roomId, true, meta.sessionId, ws);
          return;
        }

        if (message.type === "input") {
          const game = activeGames.get(meta.roomId);
          if (!game || game.status !== "playing") return;

          const p = game.players.get(meta.sessionId);
          if (!p || p.health <= 0) return;

          const speed = 5;
          let { x, y } = message.payload;
          const { attack } = message.payload;

          if (x !== 0 || y !== 0) {
            const len = Math.sqrt(x * x + y * y);
            x /= len;
            y /= len;
            p.x += x * speed;
            p.y += y * speed;
            p.x = Math.max(20, Math.min(game.width - 20, p.x));
            p.y = Math.max(20, Math.min(game.height - 20, p.y));
            if (x > 0) p.facing = "right";
            if (x < 0) p.facing = "left";
          }

          if (attack && !p.isAttacking) {
            p.isAttacking = true;
            setTimeout(() => {
              p.isAttacking = false;
            }, 200);

            game.enemies.forEach((e) => {
              const dist = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2);
              if (dist < 60) e.health -= e.type === "boss" ? 12 : 20;
            });
          }
        }
      } catch (e) {
        console.error("WS Error", e);
      }
    });

    ws.on("close", async () => {
      const meta = socketMeta.get(ws);
      socketMeta.delete(ws);
      if (!meta) return;

      await storage.removePlayer(meta.sessionId);
      const players = await storage.getPlayersInRoom(meta.roomId);

      if (players.length === 0) {
        activeGames.delete(meta.roomId);
        await storage.updateRoomStatus(meta.roomId, "finished");
      } else {
        await broadcastRoomUpdate(meta.roomId);
      }
    });
  });

  async function maybeStartGame(roomId: number, manual = false, requesterSessionId?: string, ws?: WebSocket) {
    const room = await storage.getRoom(roomId);
    if (!room || room.status !== "waiting" || activeGames.has(roomId)) return;

    const players = await storage.getPlayersInRoom(roomId);
    if (players.length < 1) return;

    const allReady = players.every((p) => p.isReady);
    const allHaveRole = players.every((p) => !!p.role);
    const uniqueRoles = new Set(players.map((p) => p.role)).size === players.length;

    if (manual) {
      const requester = players.find((p) => p.sessionId === requesterSessionId);
      if (!requester?.isHost) {
        ws?.send(JSON.stringify({ type: "error", payload: { message: "Only host can manually start." } }));
        return;
      }
    }

    if (!allReady || !allHaveRole || !uniqueRoles) {
      if (manual) {
        ws?.send(
          JSON.stringify({ type: "error", payload: { message: "Everyone must be ready with unique roles." } }),
        );
      }
      return;
    }

    await storage.updateRoomStatus(roomId, "playing");

    const gamePlayers = new Map<string, RuntimePlayerState>();
    players.forEach((p, index) => {
      gamePlayers.set(p.sessionId, {
        id: p.id,
        name: p.name,
        role: p.role || "swordsman",
        x: 180 + index * 36,
        y: ROOM_SIZE.height / 2,
        health: 100,
        maxHealth: 100,
        facing: "right",
        isAttacking: false,
      });
    });

    activeGames.set(roomId, {
      players: gamePlayers,
      enemies: [],
      projectiles: [],
      status: "playing",
      wave: 0,
      width: ROOM_SIZE.width,
      height: ROOM_SIZE.height,
      phase: "courtyard",
      phaseStartedAt: Date.now(),
    });

    await broadcastRoomUpdate(roomId);
    startGameLoop(roomId);
  }

  async function broadcastRoomUpdate(roomId: number) {
    const players = await storage.getPlayersInRoom(roomId);
    const room = await storage.getRoom(roomId);
    if (!room) return;

    const message = JSON.stringify({ type: "room_update", payload: { players, room } });
    broadcastToRoom(roomId, message);
  }

  function broadcastGameState(roomId: number, message: string) {
    broadcastToRoom(roomId, message);
  }

  function broadcastToRoom(roomId: number, message: string) {
    wss.clients.forEach((client) => {
      const meta = socketMeta.get(client);
      if (client.readyState === WebSocket.OPEN && meta?.roomId === roomId) {
        client.send(message);
      }
    });
  }

  function spawnWaveEnemies(game: GameRoomState) {
    if (game.phase === "dungeon") {
      const type = game.wave === 1 ? "goblin" : "orc";
      const count = game.wave === 1 ? 4 : 3;
      for (let i = 0; i < count; i++) {
        game.enemies.push({
          id: randomUUID(),
          type,
          x: 520 + Math.random() * 220,
          y: 80 + Math.random() * (game.height - 160),
          health: type === "goblin" ? 60 : 120,
          maxHealth: type === "goblin" ? 60 : 120,
        });
      }
    }

    if (game.phase === "boss") {
      game.enemies.push({
        id: randomUUID(),
        type: "boss",
        x: game.width - 120,
        y: game.height / 2,
        health: 600,
        maxHealth: 600,
      });
    }
  }

  function startGameLoop(roomId: number) {
    const interval = setInterval(() => {
      const game = activeGames.get(roomId);
      if (!game || game.status !== "playing") {
        clearInterval(interval);
        return;
      }

      const now = Date.now();

      if (game.phase === "courtyard") {
        const doorX = game.width - 120;
        const nearDoor = Array.from(game.players.values()).some(
          (p) => Math.sqrt((p.x - doorX) ** 2 + (p.y - game.height / 2) ** 2) < 70,
        );

        if (nearDoor || now - game.phaseStartedAt > 7000) {
          game.phase = "dungeon";
          game.wave = 1;
          game.phaseStartedAt = now;
          spawnWaveEnemies(game);
        }
      } else if (game.phase === "dungeon" && game.enemies.length === 0) {
        if (game.wave === 1) {
          game.wave = 2;
          spawnWaveEnemies(game);
        } else {
          game.phase = "boss";
          game.wave = 3;
          game.phaseStartedAt = now;
          spawnWaveEnemies(game);
        }
      } else if (game.phase === "boss" && game.enemies.length === 0) {
        game.phase = "cleared";
        game.status = "won";
      }

      game.enemies.forEach((e) => {
        let nearestDist = Infinity;
        let target: RuntimePlayerState | null = null;

        for (const p of Array.from(game.players.values())) {
          if (p.health <= 0) continue;
          const d = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
          if (d < nearestDist) {
            nearestDist = d;
            target = p;
          }
        }

        if (target) {
          const dx = target.x - e.x;
          const dy = target.y - e.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const speed = e.type === "boss" ? 1.6 : e.type === "orc" ? 1.9 : 2.3;
            e.x += (dx / len) * speed;
            e.y += (dy / len) * speed;
          }

          if (nearestDist < 30) {
            target.health -= e.type === "boss" ? 1.0 : e.type === "orc" ? 0.7 : 0.45;
          }
        }
      });

      game.enemies = game.enemies.filter((e) => e.health > 0);

      let aliveCount = 0;
      for (const p of Array.from(game.players.values())) {
        if (p.health <= 0) p.health = 0;
        else aliveCount++;
      }

      if (aliveCount === 0 && game.players.size > 0) {
        game.status = "lost";
      }

      const stateUpdate = JSON.stringify({
        type: "game_state",
        payload: {
          players: Array.from(game.players.entries()).map(([sid, p]) => ({
            id: p.id,
            sessionId: sid,
            name: p.name,
            role: p.role,
            position: { x: p.x, y: p.y },
            health: p.health,
            maxHealth: p.maxHealth,
            isDead: p.health <= 0,
            facing: p.facing,
            isAttacking: p.isAttacking,
          })),
          enemies: game.enemies.map((e) => ({
            id: e.id,
            type: e.type,
            position: { x: e.x, y: e.y },
            health: e.health,
            maxHealth: e.maxHealth,
          })),
          projectiles: game.projectiles.map((proj) => ({
            id: proj.id,
            type: "slash",
            position: { x: proj.x, y: proj.y },
          })),
          status: game.status,
          wave: game.wave,
          phase: game.phase,
        },
      });

      broadcastGameState(roomId, stateUpdate);
    }, 1000 / TICK_RATE);
  }

  return httpServer;
}
