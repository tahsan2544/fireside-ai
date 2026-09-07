import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const InputSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().max(4000).default(""),
  attachments: z
    .array(
      z.object({
        path: z.string().min(1).max(400),
        type: z.string().min(1).max(120),
        name: z.string().min(1).max(200),
      })
    )
    .max(6)
    .default([]),
});

// Streams Hearth chat replies as Server-Sent Events:
//   event: token  data: {"t":"..."}
//   event: done   data: {"assistant": {...}, "crisis": false}
//   event: error  data: {"message": "..."}
// Authenticated via the user's Supabase bearer token; RLS scopes all queries.
export const Route = createFileRoute("/api/hearth/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = InputSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input: any, init?: any) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { streamChat } = await import("@/lib/hearth-stream.server");
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const evt of streamChat(supabase, user.id, parsed.data)) {
                controller.enqueue(encoder.encode(evt));
              }
            } catch {
              try {
                controller.enqueue(
                  encoder.encode('event: error\ndata: {"message":"Something didn\'t come through. Try again."}\n\n')
                );
              } catch {
                /* stream already closed */
              }
            } finally {
              controller.close();
            }
          },
        });

        return new Response(body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
