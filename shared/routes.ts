import { z } from 'zod';
import { insertRoomSchema, insertPlayerSchema, rooms, players } from './schema';

// ============================================
// API CONTRACT
// ============================================
export const api = {
  rooms: {
    create: {
      method: 'POST' as const,
      path: '/api/rooms' as const,
      input: z.object({}), // No input needed, server generates code
      responses: {
        201: z.object({ code: z.string(), roomId: z.number() }),
      },
    },
    join: {
      method: 'POST' as const,
      path: '/api/rooms/join' as const,
      input: z.object({
        code: z.string(),
        name: z.string().min(1).max(12),
      }),
      responses: {
        200: z.object({ 
          roomId: z.number(), 
          sessionId: z.string(),
          playerId: z.number()
        }),
        404: z.object({ message: z.string() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/rooms/:code' as const,
      responses: {
        200: z.custom<typeof rooms.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    }
  },
};

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
