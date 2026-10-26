import { getTodasUFs } from "@/lib/tse";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const data = await getTodasUFs();
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
