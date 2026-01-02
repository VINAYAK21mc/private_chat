"use client"

import { Button } from "@/components/ui/button";
import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function Home() {
    return <Suspense>
        <Lobby />
    </Suspense>
}


function Lobby() {
    const router = useRouter()
    const { username } = useUsername()

    const searchParams = useSearchParams()
    const wasDestroyed = searchParams.get("destroyed") === "true"

    const error = searchParams.get("error")



    const { mutate: createRoom } = useMutation({
        mutationFn: async () => {
            const res = await client.room.create.post()

            if (res.status === 200) {
                router.push(`/room/${res.data?.roomId}`)
            }
        }
    })

    return <main className="flex min-h-screen flex-col items-center justify-between p-24">
        <div className="w-full max-w-md space-y-8">
            {wasDestroyed &&
                <div className="bg-red-950/50 border border-red-900 p-4 text-center">
                    <p className="text-red-500 text-sm font-bold">ROOM DESTROYED</p>
                    <p className="text-stone-500 text-xs mt-1">All messages were permanently deleted.</p>
                </div>
            }
            {error === "room_not_found" &&
                <div className="bg-red-950/50 border border-red-900 p-4 text-center">
                    <p className="text-red-500 text-sm font-bold">ROOM NOT FOUND</p>
                    <p className="text-stone-500 text-xs mt-1">This room may have expired or never existed.</p>
                </div>
            }
            {error === "room-full" &&
                <div className="bg-red-950/50 border border-red-900 p-4 text-center">
                    <p className="text-red-500 text-sm font-bold">ROOM FULL</p>
                    <p className="text-stone-500 text-xs mt-1">This room is at maximum capacity.</p>
                </div>
            }
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-primary">
                    {">"}private_chat
                </h1>
                <p className="text-stone-500 text-sm">
                    A private, self-destructing chat room.
                </p>
            </div>
            <div className="border border-stone-800 bg-stone-900/50 p-6 backdrop-blur-md">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="flex items-center text-stone-500">Your Identity</label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-stone-950 border border-stone-400 text-stone-400 font-mono rounded-b-sm p-3 text-sm">
                                {username}
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => createRoom()} className="w-full cursor-pointer font-bold diabled:opacity-50">
                        CREATE SECURE ROOM
                    </Button>
                </div>
            </div>
        </div>
    </main>;
}