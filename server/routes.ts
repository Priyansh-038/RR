import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { randomUUID } from "crypto";

// Game Loop Frequency
const TICK_RATE = 20; // updates per second

interface GameRoomState {
  players: Map<string, {
    x: number;
    y: number;
    role: string;
    health: number;
    maxHealth: number;
    lastAttack: number;
    facing: 'left' | 'right';
    isAttacking: boolean;
  }>;
  enemies: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    targetId?: string;
  }>;
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
  status: 'waiting' | 'playing' | 'won' | 'lost';
  wave: number;
  width: number;
  height: number;
}

const activeGames = new Map<number, GameRoomState>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === REST API ===
  app.post(api.rooms.create.path, async (req, res) => {
    const room = await storage.createRoom();
    res.status(201).json({ code: room.code, roomId: room.id });
  });

  app.post(api.rooms.join.path, async (req, res) => {
    try {
      const { code, name } = api.rooms.join.input.parse(req.body);
      const room = await storage.getRoomByCode(code);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (room.status !== 'waiting') {
        return res.status(400).json({ message: "Game already in progress" });
      }

      const existingPlayers = await storage.getPlayersInRoom(room.id);
      if (existingPlayers.length >= 5) {
        return res.status(400).json({ message: "Room is full" });
      }

      const sessionId = randomUUID();
      const player = await storage.addPlayer({
        roomId: room.id,
        name,
        sessionId,
        role: "swordsman", // Default
        isHost: existingPlayers.length === 0,
        isReady: false
      });

      res.json({ roomId: room.id, sessionId, playerId: player.id });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.get(api.rooms.get.path, async (req, res) => {
    const room = await storage.getRoomByCode(req.params.code);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  });

  // === WEBSOCKET SERVER ===
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    let roomId: number | null = null;
    let sessionId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // --- AUTH/JOIN ---
        if (message.type === 'join') {
          const { code, name } = message.payload;
          
          const room = await storage.getRoomByCode(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: "Room not found" } }));
            return;
          }
          roomId = room.id;

          // In a real app, we'd use a better session tracking, 
          // but for now we find or create player by name in this room
          const existingPlayers = await storage.getPlayersInRoom(roomId);
          let player = existingPlayers.find(p => p.name === name);
          
          if (!player) {
            if (existingPlayers.length >= 5) {
              ws.send(JSON.stringify({ type: 'error', payload: { message: "Room is full" } }));
              return;
            }
            sessionId = randomUUID();
            player = await storage.addPlayer({
              roomId: roomId,
              name,
              sessionId,
              role: "swordsman",
              isHost: existingPlayers.length === 0,
              isReady: false
            });
          } else {
            sessionId = player.sessionId;
          }

          // Broadcast room update to EVERYONE
          broadcastRoomUpdate(roomId);
        }

        if (!roomId || !sessionId) return;

        // --- LOBBY ACTIONS ---
        if (message.type === 'select_role') {
          const player = await storage.getPlayerBySessionId(sessionId);
          if (player) {
            await storage.updatePlayerRole(player.id, message.payload.role);
            broadcastRoomUpdate(roomId);
          }
        }

        if (message.type === 'ready') {
          const player = await storage.getPlayerBySessionId(sessionId);
          if (player) {
            await storage.updatePlayerReady(player.id, message.payload.isReady);
            broadcastRoomUpdate(roomId);
          }
        }

        if (message.type === 'start_game') {
          const player = await storage.getPlayerBySessionId(sessionId);
          if (player && player.isHost) {
             await storage.updateRoomStatus(roomId, 'playing');
             
             // Initialize Game State
             const players = await storage.getPlayersInRoom(roomId);
             const gamePlayers = new Map();
             players.forEach(p => {
                gamePlayers.set(p.sessionId, {
                  x: 400, y: 300, // Center spawn
                  role: p.role,
                  health: 100, // TODO: vary by role
                  maxHealth: 100,
                  lastAttack: 0,
                  facing: 'right',
                  isAttacking: false
                });
             });

             activeGames.set(roomId, {
               players: gamePlayers,
               enemies: [],
               projectiles: [],
               status: 'playing',
               wave: 1,
               width: 800,
               height: 600
             });

             broadcastRoomUpdate(roomId);
             startGameLoop(roomId);
          }
        }

        // --- GAME INPUT ---
        if (message.type === 'input') {
          const game = activeGames.get(roomId);
          if (game && game.status === 'playing') {
             const p = game.players.get(sessionId);
             if (p) {
               // Update velocity/position based on input (simplified)
               // In a real authoritative server, we'd apply physics here
               // For now, let's just accept the client's intent vector and move them
               const speed = 5;
               const { x, y, attack } = message.payload; // input vector -1 to 1
               
               // Normalize
               let dx = x;
               let dy = y;
               if (dx !== 0 || dy !== 0) {
                 const len = Math.sqrt(dx*dx + dy*dy);
                 dx /= len;
                 dy /= len;
                 p.x += dx * speed;
                 p.y += dy * speed;
                 
                 // Bounds
                 p.x = Math.max(20, Math.min(game.width - 20, p.x));
                 p.y = Math.max(20, Math.min(game.height - 20, p.y));

                 if (dx > 0) p.facing = 'right';
                 if (dx < 0) p.facing = 'left';
               }

               if (attack && !p.isAttacking) {
                 p.isAttacking = true;
                 setTimeout(() => { if (p) p.isAttacking = false; }, 200);
                 
                 // Handle Hit detection here or in game loop
                 // Simple melee check
                 game.enemies.forEach(e => {
                   const dist = Math.sqrt((e.x - p.x)**2 + (e.y - p.y)**2);
                   if (dist < 60) {
                     e.health -= 20;
                   }
                 });
               }
             }
          }
        }

      } catch (e) {
        console.error("WS Error", e);
      }
    });

    ws.on('close', async () => {
      if (sessionId && roomId) {
        await storage.removePlayer(sessionId);
        const players = await storage.getPlayersInRoom(roomId);
        if (players.length === 0) {
          activeGames.delete(roomId);
          await storage.updateRoomStatus(roomId, 'finished');
        } else {
          broadcastRoomUpdate(roomId);
        }
      }
    });
  });

  async function broadcastRoomUpdate(roomId: number) {
    const players = await storage.getPlayersInRoom(roomId);
    const room = await storage.getRoom(roomId);
    if (!room) return;

    const message = JSON.stringify({
      type: 'room_update',
      payload: { players, room }
    });

    // Broadcast to all clients in this room
    // Note: In a real app we need to map RoomID -> Set<WebSocket>
    // For this simple version, we're iterating all clients (inefficient but works for small scale)
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        // We'd check if client belongs to room, but we haven't stored that mapping in memory efficiently here
        // Ideally: client.roomId === roomId
        client.send(message); 
      }
    });
  }
  
  function startGameLoop(roomId: number) {
    const interval = setInterval(() => {
      const game = activeGames.get(roomId);
      if (!game || game.status !== 'playing') {
        clearInterval(interval);
        return;
      }

      // 1. Spawn Enemies (Wave logic)
      if (game.enemies.length === 0) {
        // Spawn wave
        for (let i = 0; i < game.wave * 2; i++) {
          game.enemies.push({
            id: randomUUID(),
            type: game.wave % 5 === 0 ? 'boss' : 'goblin',
            x: Math.random() * game.width,
            y: Math.random() * game.height,
            health: game.wave % 5 === 0 ? 500 : 50,
            maxHealth: game.wave % 5 === 0 ? 500 : 50,
          });
        }
        game.wave++;
      }

      // 2. Enemy Logic (Chase players)
      game.enemies.forEach(e => {
        // Find nearest player
        let nearestDist = Infinity;
        let target = null;
        for (const p of Array.from(game.players.values())) {
          const d = Math.sqrt((p.x - e.x)**2 + (p.y - e.y)**2);
          if (d < nearestDist) {
            nearestDist = d;
            target = p;
          }
        }

        if (target) {
           const dx = target.x - e.x;
           const dy = target.y - e.y;
           const len = Math.sqrt(dx*dx + dy*dy);
           if (len > 0) {
             const speed = e.type === 'boss' ? 1.5 : 2;
             e.x += (dx/len) * speed;
             e.y += (dy/len) * speed;
           }

           // Damage Player
           if (nearestDist < 30) {
             target.health -= 0.5; // Constant drain on contact
           }
        }
        
        if (e.health <= 0) {
           // Remove enemy
           // We'll filter later
        }
      });
      
      game.enemies = game.enemies.filter(e => e.health > 0);

      // 3. Cleanup dead players (respawn logic or game over)
      // For now, just keep them at 0 health
      let aliveCount = 0;
      for (const p of Array.from(game.players.values())) {
        if (p.health <= 0) p.health = 0;
        else aliveCount++;
      }
      
      if (aliveCount === 0 && game.players.size > 0) {
        game.status = 'lost';
      }

      // 4. Broadcast State
      const stateUpdate = JSON.stringify({
        type: 'game_state',
        payload: {
          players: Array.from(game.players.entries()).map(([sid, p]) => ({...p, sessionId: sid})),
          enemies: game.enemies,
          projectiles: game.projectiles,
          status: game.status,
          wave: game.wave
        }
      });

      wss.clients.forEach(client => {
         if (client.readyState === WebSocket.OPEN) {
           client.send(stateUpdate);
         }
      });

    }, 1000 / TICK_RATE);
  }

  return httpServer;
}
