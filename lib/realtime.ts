import { Realtime, InferRealtimeEvents } from "@upstash/realtime"
import redis from "@/lib/redis"
import z from "zod/v4"

const message=z.object({
        id: z.string(),
        sender: z.string().max(100),
        text: z.string().max(1000),
        timestamp: z.number(),
        roomId: z.string(),
        token: z.string().optional(),
    })

const schema = {
  chat: {
    message,
    destroy: z.object({
        isDestroyed:z.literal(true)
    }),
  },
}

export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
export type Message = z.infer<typeof message>