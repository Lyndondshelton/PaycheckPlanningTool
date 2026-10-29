import { connection } from "next/server";
import { getDb } from "@/lib/db/connection";

export async function GET() {
    await connection();

    // This diagnostic endpoint is available only during development.
    if (process.env.NODE_ENV !== "development") {
        return new Response(null, { status: 404 });
    }

    try {
        await getDb().query("SELECT 1");
        return Response.json({ connected: true });
    } catch {
        return Response.json(
            { connected: false },
            { status: 503 },
        );
    }
}
