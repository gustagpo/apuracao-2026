"use client";
import { useMemo, useState } from "react";

const nf = new Intl.NumberFormat("pt-BR");
const pp = (n, d = 1) => (n == null ? "–" : (n > 0 ? "+" : "") + n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (n) => (n == null ? "–" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%");
const sinal = (n) => (n > 0 ? "+" : "") + nf.format(Math.round(n));
const NOMES = { ac:"Acre", al:"Alagoas", am:"Amazonas", ap:"Amapá", ba:"Bahia", ce:"Ceará", df:"Distrito Federal", es:"Espírito Santo", go:"Goiás", ma:"Maranhão", mg:"Minas Gerais", ms:"Mato Grosso do Sul", mt:"Mato Grosso", pa:"Pará", pb:"Paraíba", pe:"Pernambuco", pi:"Piauí", pr:"Paraná", rj:"Rio de Janeiro", rn:"Rio Grande do Norte", ro:"Rondônia", rr:"Roraima", rs:"Rio Grande do Sul", sc:"Santa Catarina", se:"Sergipe", sp:"São Paulo", to:"Tocantins" };

// Monta a comparação de um nível (Brasil ou UF) entre os dois turnos
export function comparar(t1, t2) {
  if (!t1 || !t2) return null;
  const c1 = Object.fromEntries(t1.cands.map((c) => [c.n, c]));
  const c2 = Object.fromEntries(t2.cands.map((c) => [c.n, c]));
  const a = t2.cands[0], b = t2.cands[1];
  if (!a || !b || !c1[a.n] || !c1[b.n]) return null;
  const tot2 = a.vap + b.vap;
  const pa1 = c1[a.n].vap / t1.tot * 100, pb1 = c1[b.n].vap / t1.tot * 100;
  const pa2 = a.vap / tot2 * 100, pb2 = b.vap / tot2 * 100;
  const outros = t1.tot - c1[a.n].vap - c1[b.n].vap;
  return {
    a: { n: a.n, nm: a.nm, v1: c1[a.n].vap, v2: a.vap, dv: a.vap - c1[a.n].vap, p1: pa1, p2: pa2, dp: pa2 - pa1 },
    b: { n: b.n, nm: b.nm, v1: c1[b.n].vap, v2: b.vap, dv: b.vap - c1[b.n].vap, p1: pb1, p2: pb2, dp: pb2 - pb1 },
    outros, validos1: t1.tot, validos2: tot2,
    saldo1: c1[a.n].vap - c1[b.n].vap, saldo2: a.vap - b.vap,
    dsaldo: (a.vap - b.vap) - (c1[a.n].vap - c1[b.n].vap),
    virou: Math.sign(a.vap - b.vap) !== Math.sign(c1[a.n].vap - c1[b.n].vap),
  };
}

export default function Comparativo({ t1, t2br, t2ufs, cor }) {
  const [ordem, setOrdem] = useState("dsaldo");
  const br = useMemo(() => comparar(t1?.br, t2br), [t1, t2br]);
  const linhas = useMemo(() => {
    if (!t1 || !t2ufs) return [];
    return Object.keys(NOMES).map((uf) => ({ uf, c: comparar(t1[uf], t2ufs[uf]) })).filter((x) => x.c)
      .sort((x, y) => ordem === "dsaldo" ? y.c.dsaldo - x.c.dsaldo : ordem === "dp" ? y.c.a.dp - x.c.a.dp : x.uf.localeCompare(y.uf));
  }, [t1, t2ufs, ordem]);

  if (!br) return <section className="comp"><h2>1º turno × 2º turno</h2><p className="dica">Carregando os dados do 1º turno…</p></section>;

  const A = br.a, B = br.b;
  return (
    <section className="comp">
      <h2>1º turno × 2º turno</h2>
      <p className="dica">
        Entre os turnos havia {nf.format(br.outros)} votos de outros candidatos e os votos válidos foram de {nf.format(br.validos1)} para {nf.format(br.validos2)}.
        {" "}{A.nm} ganhou {nf.format(A.dv)} votos; {B.nm}, {nf.format(B.dv)}.
      </p>
      <div className="cards">
        {[A, B].map((c) => (
          <div className="cand" key={c.n} style={{ "--cor": cor(c.n) }}>
            <div className="nome">{c.nm}</div>
            <div className="pct num">{pct(c.p1)} → {pct(c.p2)} <small>({pp(c.dp)} p.p.)</small></div>
            <div className="votos num">{nf.format(c.v1)} → {nf.format(c.v2)} votos ({sinal(c.dv)})</div>
          </div>
        ))}
      </div>
      <div className="comp-ctl">
        <label>Ordenar por
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            <option value="dsaldo">votos que mudaram de lado</option>
            <option value="dp">crescimento de {A.nm} em pontos</option>
            <option value="uf">estado</option>
          </select>
        </label>
      </div>
      <div className="tabela-wrap">
        <table className="tabela num">
          <thead>
            <tr>
              <th>Estado</th>
              <th>{A.nm} 1º → 2º</th>
              <th>{B.nm} 1º → 2º</th>
              <th title="Variação do saldo entre os dois candidatos; positivo favorece o primeiro colocado nacional">Saldo mudou</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ uf, c }) => (
              <tr key={uf} className={c.virou ? "virou" : ""}>
                <td className="txt">{NOMES[uf]}{c.virou ? <small> virou</small> : null}</td>
                <td style={{ color: cor(c.a.n) }}>{pct(c.a.p1)} → {pct(c.a.p2)} <small>({pp(c.a.dp)})</small></td>
                <td style={{ color: cor(c.b.n) }}>{pct(c.b.p1)} → {pct(c.b.p2)} <small>({pp(c.b.dp)})</small></td>
                <td>{sinal(c.dsaldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="aviso">Percentuais sobre votos válidos. No 1º turno o total inclui todos os candidatos; "saldo mudou" é a diferença de votos entre {A.nm} e {B.nm} no 2º turno menos a mesma diferença no 1º.</p>
    </section>
  );
}
