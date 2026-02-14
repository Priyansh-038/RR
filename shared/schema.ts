import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: text("status", { enum: ["waiting", "playing", "finished"] }).notNull().default("waiting"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(), // Foreign key to rooms logic handled in app
  sessionId: text("session_id").notNull(), // Socket ID or unique client ID
  name: text("name").notNull(),
  role: text("role", { enum: ["swordsman", "beast", "archer", "mage", "healer"] }),
  isHost: boolean("is_host").default(false),
  isReady: boolean("is_ready").default(false),
});

// === SCHEMAS ===
export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true });
export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });

// === TYPES ===
export type Room = typeof rooms.$inferSelect;
export type Player = typeof players.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export const ROLES = ["swordsman", "beast", "archer", "mage", "healer"] as const;
export type Role = typeof ROLES[number];

// === GAME STATE TYPES (Sent via Websocket) ===

export interface Vec2 {
  x: number;
  y: number;
}

export interface GamePlayerState {
  id: number;
  sessionId: string;
  name: string;
  role: Role;
  position: Vec2;
  health: number;
  maxHealth: number;
  isDead: boolean;
  facing: 'left' | 'right';
  isAttacking: boolean;
}

export interface EnemyState {
  id: string; // uuid
  type: 'goblin' | 'orc' | 'boss';
  position: Vec2;
  health: number;
  maxHealth: number;
}

export interface ProjectileState {
  id: string;
  position: Vec2;
  type: 'arrow' | 'magic' | 'slash';
}

export interface GameState {
  players: GamePlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  status: 'playing' | 'won' | 'lost';
  wave: number;
}

// === WS MESSAGES ===
export type WsMessage = 
  | { type: 'join', payload: { code: string, name: string } }
  | { type: 'select_role', payload: { role: Role } }
  | { type: 'ready', payload: { isReady: boolean } }
  | { type: 'start_game' }
  | { type: 'input', payload: { x: number, y: number, attack: boolean } }; // Movement vector + attack trigger

export type ServerMessage = 
  | { type: 'room_update', payload: { players: Player[], room: Room } }
  | { type: 'game_state', payload: GameState }
  | { type: 'error', payload: { message: string } };
