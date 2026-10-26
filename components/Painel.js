"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSqrt } from "d3-scale";

const UFS = ["ac","al","am","ap","ba","ce","df","es","go","ma","mg","ms","mt","pa","pb","pe","pi","pr","rj","rn","ro","rr","rs","sc","se","sp","to"];
const nf = new Intl.NumberFormat("pt-BR");
const pct = (n) => (n == null ? "–" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%");
const paleta = ["var(--c13)", "var(--c22)", "#7B5EA7", "#2A9D8F"];
const cores = {};
const cor = (n) => { if (!cores[n]) cores[n] = n === "13" ? "var(--c13)" : n === "22" ? "var(--c22)" : paleta[Object.keys(cores).length % paleta.length]; return cores[n]; };
const lider = (p) => { if (!p || !p.cands?.length || !p.tot) return null; const l = p.cands[0], s = p.cands[1]; return { c: l, marg: s ? ((l.vap - s.vap) / p.tot) * 100 : 100 }; };
const corArea = (p) => { const L = lider(p); if (!L) return "var(--mapa-vazio)"; const a = 0.35 + Math.min(1, L.marg / 30) * 0.65; return `color-mix(in srgb, ${cor(L.c.n)} ${Math.round(a * 100)}%, var(--mapa-vazio))`; };

async function api(path) {
  const r = await fetch(path, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function Painel() {
  const [br, setBr] = useState(null);
  const [ufs, setUfs] = useState({});
  const [geo, setGeo] = useState(null);
  const [ufSel, setUfSel] = useState(null);
  const [muns, setMuns] = useState(null);
  const [munsCarregando, setMunsCarregando] = useState(false);
  const [intervalo, setIntervalo] = useState(10);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState(false);
  const [tip, setTip] = useState(null);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const buscando = useRef(false);
  const mapaRef = useRef(null);

  const { proj, path } = useMemo(() => {
    if (!geo) return {};
    const proj = geoMercator().fitExtent([[10, 10], [690, 690]], geo);
    return { proj, path: geoPath(proj) };
  }, [geo]);

  const transform = useMemo(() => {
    if (!geo || !path || !ufSel) return { t: "", k: 1 };
    const f = geo.features.find((f) => f.properties.sigla.toLowerCase() === ufSel);
    if (!f) return { t: "", k: 1 };
    const b = path.bounds(f), w = b[1][0] - b[0][0], h = b[1][1] - b[0][1];
    const k = Math.min((0.9 * 700) / w, (0.9 * 700) / h);
    return { t: `translate(${350 - k * (b[0][0] + w / 2)},${350 - k * (b[0][1] + h / 2)}) scale(${k})`, k };
  }, [geo, path, ufSel]);

  const buscar = useCallback(async () => {
    if (buscando.current) return;
    buscando.current = true;
    try {
      const [b, u] = await Promise.all([api("/api/brasil"), api("/api/ufs")]);
      setBr(b); setUfs(u); setAtualizadoEm(new Date());
      const faltam = UFS.length - Object.keys(u).length;
      setErro(false); setMsg(faltam ? `${faltam} estado(s) sem resposta neste ciclo.` : "");
    } catch (e) {
      setErro(true); setMsg(`Falha ao ler o TSE: ${e.message}. Tentando de novo no próximo ciclo.`);
    } finally { buscando.current = false; }
  }, []);

  const buscarMuns = useCallback(async (uf) => {
    if (!uf) return;
    setMunsCarregando(true);
    try { const d = await api(`/api/municipios/${uf}`); setMuns((prev) => (prev?.uf === uf ? { ...d, primeira: false } : { ...d, primeira: true })); }
    catch (e) { setMsg(`Cidades de ${uf.toUpperCase()}: ${e.message}`); setErro(true); }
    finally { setMunsCarregando(false); }
  }, []);

  useEffect(() => { api("/api/geo").then(setGeo).catch((e) => { setErro(true); setMsg(`Sem contorno do mapa (${e.message}); os números seguem funcionando.`); }); buscar(); }, [buscar]);

  useEffect(() => {
    if (!intervalo) return;
    const encerrada = br?.pst != null && br.pst >= 100;
    if (encerrada) return;
    const id = setInterval(() => { if (!document.hidden) buscar(); }, intervalo * 1000);
    return () => clearInterval(id);
  }, [intervalo, buscar, br]);

  useEffect(() => {
    if (!ufSel) { setMuns(null); return; }
    buscarMuns(ufSel);
    const id = setInterval(() => { if (!document.hidden) buscarMuns(ufSel); }, 30000);
    return () => clearInterval(id);
  }, [ufSel, buscarMuns]);

  const L = lider(br);
  const encerrada = br?.pst != null && br.pst >= 100;

  const pontos = useMemo(() => {
    if (!muns || !proj) return [];
    const arr = muns.municipios.filter((m) => m.ll && m.tot > 0);
    const r = scaleSqrt().domain([0, Math.max(1, ...arr.map((m) => m.tot))]).range([1.5, 22]);
    return arr.map((m) => { const [x, y] = proj(m.ll); return { ...m, x, y, r: r(m.tot) / transform.k }; });
  }, [muns, proj, transform.k]);

  const listaMuns = useMemo(() => {
    if (!muns) return [];
    const arr = muns.municipios.filter((m) => m.tot > 0);
    const mudados = arr.filter((m) => m.mudou), resto = arr.filter((m) => !m.mudou);
    return (mudados.length ? mudados.concat(resto) : arr).slice(0, 120);
  }, [muns]);

  const mostrarTip = (ev, titulo, p) => {
    const r = mapaRef.current.getBoundingClientRect();
    setTip({ x: Math.min(ev.clientX - r.left + 12, r.width - 270), y: ev.clientY - r.top + 12, titulo, p });
  };

  return (
    <>
      <div className="cards">
        {(br?.cands || []).map((c) => (
          <div className="cand" key={c.n} style={{ "--cor": cor(c.n) }}>
            <div className="nome">{c.nm}{c.sg ? ` · ${c.sg}` : ""}{c.n ? ` (${c.n})` : ""}</div>
            <div className="pct num">{pct(c.pvap)}</div>
            <div className="votos num">{nf.format(c.vap)} votos{c.e ? " · eleito" : ""}</div>
          </div>
        ))}
        {!br && <div className="cand" style={{ "--cor": "var(--linha)" }}><div className="nome">Conectando ao TSE…</div></div>}
      </div>

      <section className="estado" aria-live="polite">
        <span>{!br ? "Aguardando a primeira parcial" : encerrada ? "Apuração encerrada" : "Seções totalizadas no Brasil"}</span>
        <span className="pctg num">{br?.pst != null ? pct(br.pst) : ""}</span>
        <div className="barra"><i style={{ width: `${br?.pst || 0}%` }} /></div>
        {br && (
          <div className="extras num">
            <span>Válidos <b>{br.vv != null ? nf.format(br.vv) : "–"}</b></span>
            <span>Brancos <b>{pct(br.pvb)}</b></span>
            <span>Nulos <b>{pct(br.ptvn)}</b></span>
            <span>Abstenção <b>{pct(br.pa)}</b></span>
          </div>
        )}
        <span className="nota">
          {L && br.cands[1] ? `${L.c.nm} lidera por ${pct(L.marg)} dos votos computados. ` : ""}
          {br?.dg ? `Dados do TSE de ${br.dg} às ${br.hg}. ` : ""}
          {atualizadoEm ? `Painel atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR")}.` : ""}
        </span>
      </section>

      <div className="grid">
        <div className="mapa" ref={mapaRef}>
          <svg viewBox="0 0 700 700" role="img" aria-label="Mapa do Brasil por estado com o candidato que lidera" onMouseLeave={() => setTip(null)}>
            <g transform={transform.t}>
              {geo && path && geo.features.map((f) => {
                const u = f.properties.sigla.toLowerCase();
                return (
                  <path key={u} d={path(f)} className={`uf${ufSel === u ? " sel" : ""}`} fill={corArea(ufs[u])}
                    style={{ strokeWidth: 0.8 / transform.k }}
                    onMouseMove={(ev) => mostrarTip(ev, f.properties.name, ufs[u])}
                    onClick={() => setUfSel(ufSel === u ? null : u)} />
                );
              })}
            </g>
            <g transform={transform.t}>
              {pontos.map((m) => (
                <circle key={m.cd} cx={m.x} cy={m.y} r={m.r} className={`mun${m.mudou && !muns.primeira ? " pulse" : ""}`}
                  fill={lider(m) ? cor(lider(m).c.n) : "var(--mapa-vazio)"} style={{ strokeWidth: 0.5 / transform.k }}
                  onMouseMove={(ev) => mostrarTip(ev, `${m.nm} (${ufSel.toUpperCase()})`, m)} />
              ))}
            </g>
          </svg>
          {tip && (
            <div className="tip" style={{ left: tip.x, top: tip.y }}>
              <b>{tip.titulo}</b>
              {tip.p?.cands?.length ? tip.p.cands.map((c) => <div key={c.n}>{c.nm}: {pct(c.pvap)} ({nf.format(c.vap)})</div>) : "Sem votos apurados ainda"}
              {tip.p?.pst != null && <div>Seções: {pct(tip.p.pst)}</div>}
            </div>
          )}
          <div className="legenda">
            {(br?.cands || []).map((c) => <span key={c.n}><i style={{ background: cor(c.n) }} />{c.nm} lidera</span>)}
            <span><i style={{ background: "var(--mapa-vazio)" }} />sem votos ainda</span>
          </div>
        </div>

        <aside className="lado">
          {!ufSel ? (
            <>
              <h2>Por estado</h2>
              <p className="dica">Toque em um estado para ver as cidades de onde os votos estão chegando.</p>
              <ol className="lista">
                {UFS.map((u) => ({ u, p: ufs[u] })).filter((x) => x.p).sort((a, b) => (b.p.tot || 0) - (a.p.tot || 0)).map(({ u, p }) => {
                  const l = lider(p);
                  return (
                    <li key={u} onClick={() => setUfSel(u)}>
                      <span className="cid">{u.toUpperCase()}</span>
                      <span className="lid num" style={{ color: l ? cor(l.c.n) : undefined }}>{l ? `${l.c.nm} ${pct(l.c.pvap)}` : "–"}</span>
                      <span className="det num">{p.pst != null ? `${pct(p.pst)} das seções · ` : ""}{nf.format(p.tot)} votos</span>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <>
              <h2>Cidades de {ufSel.toUpperCase()}</h2>
              <p className={`dica${erro && !muns ? " erro" : ""}`}>
                {munsCarregando && !muns ? "Lendo os municípios no TSE…" :
                 muns ? `${muns.municipios.filter((m) => m.tot > 0).length} de ${muns.total} cidades já com votos${!muns.primeira ? ` · ${muns.municipios.filter((m) => m.mudou).length} atualizadas neste ciclo` : ""}. Bolha maior = mais votos.${munsCarregando ? " Atualizando…" : ""}` : ""}
              </p>
              <ol className="lista">
                {listaMuns.map((m) => {
                  const l = lider(m);
                  return (
                    <li key={m.cd} className={m.mudou && !muns.primeira ? "novo" : ""}>
                      <span className="cid">{m.nm}</span>
                      <span className="lid num" style={{ color: l ? cor(l.c.n) : undefined }}>{l ? `${l.c.nm} ${pct(l.c.pvap)}` : "–"}</span>
                      <span className="det num">{nf.format(m.tot)} votos{m.pst != null ? ` · ${pct(m.pst)} das seções` : ""}{m.hg ? ` · ${m.hg}` : ""}</span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </aside>
      </div>

      <div className="controles">
        <button onClick={buscar}>Atualizar agora</button>
        {ufSel && <button className="sec" onClick={() => setUfSel(null)}>Voltar ao Brasil</button>}
        <label>Atualizar sozinho
          <select value={intervalo} onChange={(e) => setIntervalo(+e.target.value)}>
            <option value={10}>a cada 10 s</option>
            <option value={30}>a cada 30 s</option>
            <option value={60}>a cada 1 min</option>
            <option value={0}>nunca</option>
          </select>
        </label>
      </div>
      <p className={`aviso${erro ? " erro" : ""}`}>{msg}</p>
      <p className="aviso">O servidor lê o TSE no máximo uma vez a cada 10 s (Brasil e estados) e a cada 30 s (cidades do estado escolhido), independentemente de quantas pessoas abrirem o painel. Fonte: <a href="https://resultados.tse.jus.br" target="_blank" rel="noopener noreferrer">resultados.tse.jus.br</a>.</p>
    </>
  );
}
