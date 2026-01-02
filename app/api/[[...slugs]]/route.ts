import redis from '@/lib/redis'
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth'
import { z } from 'zod'
import { Message, realtime } from '@/lib/realtime'

const ROOM_TTL_SECONDS = 30 * 60 //30 minutes

const rooms = new Elysia({ prefix: '/room' })
    .post('/create', async () => {
        const roomId = nanoid()

        await redis.hset(`meta:${roomId}`, {
            connected: [],
            createdAt: Date.now()
        })

        await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS) //30 minutes
        return { roomId }
    })
    .use(authMiddleware)
    .get("/ttl", async ({ auth }) => {
        const ttl = await redis.ttl(`meta:${auth.roomId}`)
        return { ttl: ttl > 0 ? ttl : 0 }
    }, {
        query: z.object({ roomId: z.string() })
    })
    .delete("/", async ({ auth }) => {
        await realtime.channel(auth.roomId).emit("chat.destroy", { isDestroyed: true })
        await Promise.all([
            redis.del(`messages:${auth.roomId}`),
            redis.del(`meta:${auth.roomId}`),
            redis.del(auth.roomId)
        ])

    }, {
        query: z.object({ roomId: z.string() })
    })

const messages = new Elysia({ prefix: "/messages" })
    .use(authMiddleware)
    .post("/", async ({ body, auth }) => {
        const { sender, text } = body
        const { roomId, token } = auth

        const roomExists = redis.exists(`meta:${roomId}`)
        if (!roomExists) {
            throw new Error("Room not found")
        }

        const message: Message = {
            id: nanoid(),
            sender,
            text,
            timestamp: Date.now(),
            roomId,
            token
        }

        await redis.rpush(`messages:${roomId}`, JSON.stringify(message))
        await realtime.channel(`${roomId}`).emit("chat.message", message)

        const remainingTTL = await redis.ttl(`meta:${roomId}`)
        await redis.expire(`messages:${roomId}`, remainingTTL)
        await redis.expire(`history:${roomId}`, remainingTTL)
        await redis.expire(roomId, remainingTTL)

    },
        {
            body: z.object({
                sender: z.string().max(100),
                text: z.string().max(1000)
            })
        })
    .get(
        "/",
        async ({ auth }) => {
            const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)
            return {
                messages: messages.map((m) => ({
                    ...m,
                    token: m.token === auth.token ? auth.token : undefined,
                })),
            }
        },
        { query: z.object({ roomId: z.string() }) }
    )


const app = new Elysia({ prefix: '/api' }).use(rooms).use(messages)

export type App = typeof app
export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch