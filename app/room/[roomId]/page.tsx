"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useUsername } from "@/hooks/use-username"
import { client } from "@/lib/client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { useRealtime } from "@/lib/realtime-client"


const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}


export default function RoomPage() {
    const params = useParams()
    const roomId = params.roomId as string
    const router = useRouter()

    const [copyStatus, setCopyStatus] = useState(false)
    const [timeremaining, setTimeremaining] = useState<number | null>(null)
    const [input, setInput] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const { username } = useUsername()

    const { data: ttlData } = useQuery({
        queryKey: ["room", roomId],
        queryFn: async () => {
            const res = await client.room.ttl.get({ query: { roomId } })
            return res.data
        },
    })

    useEffect(() => {
        if (ttlData?.ttl !== undefined) {
            setTimeremaining(ttlData.ttl)
        }
    }, [ttlData])

    useEffect(() => {
        if (timeremaining === null || timeremaining < 0)
            return

        if (timeremaining === 0) {
            router.push("/?destroyed=true")
            return
        }
        const interval = setInterval(() => {
            setTimeremaining((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval)
                    return 0
                }
                return prev - 1
            }
            )
        },1000)
        return () => clearInterval(interval)
    },[timeremaining, router])


const { data: messages, refetch } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
        const res = await client.messages.get({ query: { roomId } })
        if (res.status === 200) {
            return res.data
        }
    },
})

const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
        await client.messages.post({
            sender: username,
            text
        }, { query: { roomId } })
        setInput("")

    }
})

const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
        await client.room.delete(null,{ query: { roomId } })
    }

})



useRealtime({
    channels: [roomId],
    events: ["chat.destroy", "chat.message"],
    onData: ({ event }) => {
        if (event === "chat.message") {
            refetch()
        }

        if (event === "chat.destroy") {
            router.push("/?destroyed=true")
        }
    },
})

const copyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopyStatus(true)
    setTimeout(() => {
        setCopyStatus(false)
    }, 2000)
}

return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
        <header className="border-b border-stone-800 p-4 flex items-center justify-between bg-stone-900/30 backdrop-blur-md">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-xs text-stone-500 uppercase">ROOM ID</span>
                    <div className="flex items-center gap-2">
                        <span className="font-bold  text-primary">{roomId}</span>
                        <Button onClick={copyLink} size={"sm"} variant={"secondary"}>{copyStatus ? "COPIED!" : "Copy"}</Button>
                    </div>
                </div>
                <Separator orientation="vertical" />
                <div className="flex flex-col">
                    <span className="text-xs text-stone-500 uppercase">Self-Destruct</span>
                    <span className={`text-sm font-bold flex items-center gap-2 ${timeremaining !== null ? (timeremaining > 60 ? (timeremaining < 300 ? "text-amber-500" : "text-primary") : "text-red-500") : ""}`}>
                        {timeremaining !== null ? formatTimeRemaining(timeremaining) : "--:--"}
                    </span>
                </div>
            </div>
            <Button variant={"destructive"} className="group font-bold opacity-80 hover:opacity-200 disabled:opacity-5 gap-2 text-xs" onClick={()=>destroyRoom()}>
                <span className="group-hover:animate-bounce inline-block">💣</span>
                DESTROY NOW
            </Button>
        </header>
        <div className="flex-1 overlfow-y-auto p-4 space-y-4 no-scrollbar">
            {messages?.messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                    <p className="text-stone-600 text-sm font-mono">
                        No messages yet, start the conversation.
                    </p>
                </div>
            )}
            {messages?.messages.map((msg) =>
                <div key={msg.id} className="flex flex-col items-start">
                    <div className="max-w-[80%] group">
                        <div className="flex items-baseline gap-3 mb-1">
                            <span className={`text-xs font-bold ${msg.sender === username ? "text-amber-500" : "text-lime-500"}`}>
                                {msg.sender === username ? "YOU" : msg.sender}
                            </span>
                            <span className="text-xs text-stone-500">{format(msg.timestamp, "HH:mm")}</span>
                        </div>
                        <p className="text-sm text-stone-300 leading-relaxed break-all">{msg.text}</p>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-stone-800 bg-stone-900/30">
            <div className="flex gap-4">
                <div className="flex-1 relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary animate-pulse">
                        {">"}
                    </span>
                    <Input value={input}
                        ref={inputRef}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && input.trim()) {
                                sendMessage({ text: input })
                                inputRef.current?.focus()
                            }
                        }}
                        onChange={(e) => setInput(e.target.value)}
                        autoFocus
                        placeholder="Type message..."
                        type="text"
                        className="w-full bg-black border border-stone-800 focus:border-stone-700 focus:outline-none transition-colors text-stone-100 py-3 pl-8 pr-4 text-sm"
                    />
                </div>
                <Button className="bg-stone-800 text-stone-400 px-6 text-sm font-bold hover:text-stone-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    disabled={!input.trim() || isPending}
                    onClick={() => {
                        sendMessage({ text: input })
                        inputRef.current?.focus()
                    }}>
                    SEND
                </Button>
            </div>
        </div>
    </main>
)
}
