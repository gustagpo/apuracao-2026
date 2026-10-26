import { cached } from "@/lib/tse";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const geo = await cached("geo", 24 * 3600_000, async () => {
      const r = await fetch("https://cdn.jsdelivr.net/gh/codeforgermany/click_that_hood@main/public/data/brazil-states.geojson");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
    return Response.json(geo, { headers: { "Cache-Control": "public, s-maxage=86400, immutable" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
