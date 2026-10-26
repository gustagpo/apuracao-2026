import { parse, cached, UFS } from "@/lib/tse";
export const dynamic = "force-dynamic";
const BASE1 = "https://resultados.tse.jus.br/oficial/ele2026/6257/";
export async function GET() {
  try {
    const data = await cached("ufs1t", 3600_000, async () => {
      const res = await Promise.allSettled(UFS.concat(["br"]).map(async (u) => {
        const r = await fetch(`${BASE1}dados/${u}/${u}-c0001-e006257-u.json`, { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        return parse(await r.json());
      }));
      const out = {};
      res.forEach((r, i) => { if (r.status === "fulfilled") out[UFS.concat(["br"])[i]] = r.value; });
      return out;
    });
    return Response.json(data);
  } catch (e) { return Response.json({ error: e.message }, { status: 502 }); }
}
