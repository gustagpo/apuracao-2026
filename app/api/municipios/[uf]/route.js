import { getMunicipios, UFS } from "@/lib/tse";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(_req, { params }) {
  const { uf } = await params;
  const u = String(uf || "").toLowerCase();
  if (!UFS.includes(u)) return Response.json({ error: "UF inválida" }, { status: 400 });
  try {
    const data = await getMunicipios(u);
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
