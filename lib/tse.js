// Worker de leitura do TSE: busca os JSONs oficiais, normaliza e mantém cache em memória.
// Em Vercel cada instância tem seu cache; o TTL garante no máximo 1 leitura no TSE por intervalo por instância.

export const BASE = "https://resultados.tse.jus.br/oficial/ele2026/6258/";
export const ELE = "006258";
export const UFS = ["ac","al","am","ap","ba","ce","df","es","go","ma","mg","ms","mt","pa","pb","pe","pi","pr","rj","rn","ro","rr","rs","sc","se","sp","to"];

const cache = globalThis.__tseCache || (globalThis.__tseCache = new Map());

function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Parser do formato -u.json 2026: raiz com s, e, v, dg, hg e carg[0].agr[].par[].cand[]
// (aceita também o formato antigo com abr[0].cand)
export function parse(j) {
  const a = (j.abr && j.abr[0]) || j;
  const s = j.s || a.s || {};
  const v = j.v || a.v || a;
  const e = j.e || a.e || {};
  const brutos = [];
  for (const carg of j.carg || a.carg || []) {
    for (const agr of carg.agr || []) {
      for (const par of agr.par || []) {
        for (const c of par.cand || []) brutos.push({ ...c, sg: par.sg });
      }
    }
  }
  if (!brutos.length) brutos.push(...(a.cand || j.cand || []));
  const cands = brutos
    .map((c) => ({
      n: String(c.n ?? c.nr ?? ""),
      nm: c.nmu || c.nm || c.nome || `Candidato ${c.n}`,
      sg: c.sg || "",
      vap: num(c.vap) || 0,
      pvap: num(c.pvapn ?? c.pvap),
      e: c.e === "s" || c.e === true,
    }))
    .sort((x, y) => y.vap - x.vap);
  return {
    cands,
    pst: num(s.pst ?? a.pst ?? j.pst),
    st: num(s.st), ts: num(s.ts),
    vv: num(v.vv), vb: num(v.vb), pvb: num(v.pvb), tvn: num(v.tvn), ptvn: num(v.ptvn),
    a: num(e.a), pa: num(e.pa),
    dg: j.dg || a.dg || null, hg: j.hg || a.hg || null,
    tot: cands.reduce((t, c) => t + c.vap, 0),
  };
}

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": "apuracao-painel/1.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url.split("/").pop()}`);
  return r.json();
}

// Cache com TTL + deduplicação de requisições simultâneas
export async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.exp > now) return hit.val;
  if (hit && hit.pending) return hit.pending;
  const pending = loader()
    .then((val) => { cache.set(key, { val, exp: Date.now() + ttlMs }); return val; })
    .catch((err) => { if (hit) { cache.set(key, { val: hit.val, exp: Date.now() + 5000 }); return hit.val; } cache.delete(key); throw err; });
  cache.set(key, { ...(hit || {}), pending });
  return pending;
}

export const getBrasil = () =>
  cached("br", 10_000, async () => parse(await fetchJSON(`${BASE}dados/br/br-c0001-e${ELE}-u.json`)));

export const getUF = (uf) =>
  cached(`uf:${uf}`, 10_000, async () => parse(await fetchJSON(`${BASE}dados/${uf}/${uf}-c0001-e${ELE}-u.json`)));

export const getTodasUFs = () =>
  cached("ufs", 10_000, async () => {
    const res = await Promise.allSettled(UFS.map(getUF));
    const out = {};
    res.forEach((r, i) => { if (r.status === "fulfilled") out[UFS[i]] = r.value; });
    return out;
  });

// Lista de municípios por UF (config do TSE), cache longo
export const getMunConfig = () =>
  cached("muncfg", 6 * 3600_000, async () => {
    const cfg = await fetchJSON(`${BASE}config/mun-e${ELE}-cm.json`);
    const out = {};
    for (const a of cfg.abr || []) {
      out[String(a.cd).toLowerCase()] = (a.mu || []).map((m) => ({ cd: String(m.cd), cdi: String(m.cdi || ""), nm: m.nm }));
    }
    return out;
  });

// Coordenadas dos municípios (IBGE -> lon/lat), cache longo
export const getCoords = () =>
  cached("coords", 24 * 3600_000, async () => {
    const r = await fetch("https://cdn.jsdelivr.net/gh/kelvins/municipios-brasileiros@main/json/municipios.json");
    const arr = await r.json();
    const out = {};
    for (const m of arr) out[String(m.codigo_ibge)] = [m.longitude, m.latitude];
    return out;
  });

// Todos os municípios de uma UF, com concorrência limitada. TTL 30 s.
export const getMunicipios = (uf) =>
  cached(`mun:${uf}`, 30_000, async () => {
    const [cfg, coords] = await Promise.all([getMunConfig(), getCoords()]);
    const lista = cfg[uf] || [];
    const fila = lista.slice();
    const out = [];
    const anterior = cache.get(`mun:${uf}`)?.val;
    const antes = new Map((anterior?.municipios || []).map((m) => [m.cd, m.tot]));
    async function worker() {
      while (fila.length) {
        const m = fila.shift();
        try {
          const p = parse(await fetchJSON(`${BASE}dados/${uf}/${uf}${m.cd}-c0001-e${ELE}-u.json`));
          out.push({ cd: m.cd, nm: m.nm, ll: coords[m.cdi] || null, cands: p.cands, pst: p.pst, hg: p.hg, tot: p.tot,
                     mudou: antes.has(m.cd) ? antes.get(m.cd) !== p.tot : false });
        } catch { /* município sem arquivo ainda */ }
      }
    }
    await Promise.all(Array.from({ length: 24 }, worker));
    out.sort((a, b) => b.tot - a.tot);
    return { uf, total: lista.length, lidoEm: Date.now(), municipios: out };
  });
