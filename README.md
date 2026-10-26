# Apuração 2026 — painel no mapa

Painel de apuração do 2º turno da eleição presidencial de 2026, com dados oficiais do TSE
(`resultados.tse.jus.br`), em Next.js 16 / React 19.

Em produção: https://apuracao-2026-dtecdigital.vercel.app

## Como funciona

- `lib/tse.js` — "worker" do lado do servidor: lê os JSONs de divulgação do TSE
  (eleição 6258), normaliza o formato (`carg[].agr[].par[].cand[]`) e mantém cache em memória
  com TTL (10 s para Brasil e UFs, 30 s para municípios de uma UF).
- `app/api/brasil`, `app/api/ufs`, `app/api/municipios/[uf]` — rotas que servem os dados
  normalizados; `app/api/ufs1t` serve o 1º turno (eleição 6257) por estado; `app/api/geo`
  serve o GeoJSON dos estados.
- `components/Painel.js` — front: mapa SVG (d3-geo) colorido pelo candidato que lidera,
  bolhas por município ao clicar em um estado, lista das cidades que atualizaram no último ciclo.

## Rodando

```bash
npm install
npm run dev
```

Deploy: qualquer host Node ou Vercel (`vercel deploy`).

## Fontes

- Resultados: https://resultados.tse.jus.br
- Contorno dos estados: codeforgermany/click_that_hood
- Coordenadas dos municípios: kelvins/municipios-brasileiros
