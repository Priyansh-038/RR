import { db } from "./db";
import {
  rooms,
  players,
  type Room,
  type Player,
  type InsertRoom,
  type InsertPlayer
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Rooms
  createRoom(): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoom(id: number): Promise<Room | undefined>;
  updateRoomStatus(id: number, status: Room["status"]): Promise<Room>;
  
  // Players
  addPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersInRoom(roomId: number): Promise<Player[]>;
  updatePlayerRole(id: number, role: string): Promise<Player>;
  updatePlayerReady(id: number, isReady: boolean): Promise<Player>;
  removePlayer(sessionId: string): Promise<void>;
  getPlayerBySessionId(sessionId: string): Promise<Player | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createRoom(): Promise<Room> {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const [room] = await db.insert(rooms).values({
      code,
      status: "waiting"
    }).returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room;
  }

  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async updateRoomStatus(id: number, status: Room["status"]): Promise<Room> {
    const [room] = await db.update(rooms)
      .set({ status })
      .where(eq(rooms.id, id))
      .returning();
    return room;
  }

  async addPlayer(player: InsertPlayer): Promise<Player> {
    const [newPlayer] = await db.insert(players).values(player).returning();
    return newPlayer;
  }

  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async getPlayersInRoom(roomId: number): Promise<Player[]> {
    return await db.select().from(players).where(eq(players.roomId, roomId));
  }

  async updatePlayerRole(id: number, role: string): Promise<Player> {
    const [player] = await db.update(players)
      .set({ role: role as any }) // Type cast safe due to schema validation elsewhere
      .where(eq(players.id, id))
      .returning();
    return player;
  }

  async updatePlayerReady(id: number, isReady: boolean): Promise<Player> {
    const [player] = await db.update(players)
      .set({ isReady })
      .where(eq(players.id, id))
      .returning();
    return player;
  }

  async removePlayer(sessionId: string): Promise<void> {
    await db.delete(players).where(eq(players.sessionId, sessionId));
  }
  
  async getPlayerBySessionId(sessionId: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.sessionId, sessionId));
    return player;
  }
}

export const storage = new DatabaseStorage();
