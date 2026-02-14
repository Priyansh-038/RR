import {
  rooms,
  players,
  type Room,
  type Player,
  type InsertPlayer,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, isDatabaseConfigured } from "./db";

export interface IStorage {
  createRoom(): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoom(id: number): Promise<Room | undefined>;
  updateRoomStatus(id: number, status: Room["status"]): Promise<Room>;
  addPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersInRoom(roomId: number): Promise<Player[]>;
  updatePlayerRole(id: number, role: string): Promise<Player>;
  updatePlayerReady(id: number, isReady: boolean): Promise<Player>;
  removePlayer(sessionId: string): Promise<void>;
  getPlayerBySessionId(sessionId: string): Promise<Player | undefined>;
}

function createRoomCode(existingCodes: Set<string>) {
  let code = "";
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (existingCodes.has(code));
  return code;
}

class MemoryStorage implements IStorage {
  private roomId = 1;
  private playerId = 1;
  private rooms = new Map<number, Room>();
  private players = new Map<number, Player>();

  async createRoom(): Promise<Room> {
    const existingCodes = new Set(Array.from(this.rooms.values()).map((room) => room.code));
    const room: Room = {
      id: this.roomId++,
      code: createRoomCode(existingCodes),
      status: "waiting",
      createdAt: new Date(),
    };
    this.rooms.set(room.id, room);
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find((room) => room.code === code);
  }

  async getRoom(id: number): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async updateRoomStatus(id: number, status: Room["status"]): Promise<Room> {
    const room = this.rooms.get(id);
    if (!room) throw new Error("Room not found");
    const updated = { ...room, status };
    this.rooms.set(id, updated);
    return updated;
  }

  async addPlayer(player: InsertPlayer): Promise<Player> {
    const newPlayer: Player = {
      id: this.playerId++,
      roomId: player.roomId,
      sessionId: player.sessionId,
      name: player.name,
      role: player.role ?? null,
      isHost: player.isHost ?? false,
      isReady: player.isReady ?? false,
    };
    this.players.set(newPlayer.id, newPlayer);
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersInRoom(roomId: number): Promise<Player[]> {
    return Array.from(this.players.values()).filter((player) => player.roomId === roomId);
  }

  async updatePlayerRole(id: number, role: string): Promise<Player> {
    const player = this.players.get(id);
    if (!player) throw new Error("Player not found");
    const updated = { ...player, role: role as Player["role"] };
    this.players.set(id, updated);
    return updated;
  }

  async updatePlayerReady(id: number, isReady: boolean): Promise<Player> {
    const player = this.players.get(id);
    if (!player) throw new Error("Player not found");
    const updated = { ...player, isReady };
    this.players.set(id, updated);
    return updated;
  }

  async removePlayer(sessionId: string): Promise<void> {
    const player = Array.from(this.players.values()).find((p) => p.sessionId === sessionId);
    if (!player) return;
    this.players.delete(player.id);
  }

  async getPlayerBySessionId(sessionId: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find((player) => player.sessionId === sessionId);
  }
}

class DatabaseStorage implements IStorage {
  async createRoom(): Promise<Room> {
    if (!db) throw new Error("Database not configured");
    const existing = await db.select({ code: rooms.code }).from(rooms);
    const roomCode = createRoomCode(new Set(existing.map((row) => row.code)));
    const [room] = await db.insert(rooms).values({ code: roomCode, status: "waiting" }).returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    if (!db) return undefined;
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room;
  }

  async getRoom(id: number): Promise<Room | undefined> {
    if (!db) return undefined;
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async updateRoomStatus(id: number, status: Room["status"]): Promise<Room> {
    if (!db) throw new Error("Database not configured");
    const [room] = await db.update(rooms).set({ status }).where(eq(rooms.id, id)).returning();
    return room;
  }

  async addPlayer(player: InsertPlayer): Promise<Player> {
    if (!db) throw new Error("Database not configured");
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    if (!db) return undefined;
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async getPlayersInRoom(roomId: number): Promise<Player[]> {
    if (!db) return [];
    return db.select().from(players).where(eq(players.roomId, roomId));
  }

  async updatePlayerRole(id: number, role: string): Promise<Player> {
    if (!db) throw new Error("Database not configured");
    const [player] = await db.update(players).set({ role: role as any }).where(eq(players.id, id)).returning();
    return player;
  }

  async updatePlayerReady(id: number, isReady: boolean): Promise<Player> {
    if (!db) throw new Error("Database not configured");
    const [player] = await db.update(players).set({ isReady }).where(eq(players.id, id)).returning();
    return player;
  }

  async removePlayer(sessionId: string): Promise<void> {
    if (!db) return;
    await db.delete(players).where(eq(players.sessionId, sessionId));
  }

  async getPlayerBySessionId(sessionId: string): Promise<Player | undefined> {
    if (!db) return undefined;
    const [player] = await db.select().from(players).where(eq(players.sessionId, sessionId));
    return player;
  }
}

export const storage: IStorage = isDatabaseConfigured() ? new DatabaseStorage() : new MemoryStorage();
