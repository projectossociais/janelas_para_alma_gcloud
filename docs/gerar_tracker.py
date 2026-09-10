#!/usr/bin/env python3
"""Gera docs/tracker.html a partir de docs/tarefas.csv.

O tracker é uma VISTA só-leitura — o CSV é a fonte. Correr sempre que o
tarefas.csv mudar:

    python docs/gerar_tracker.py

Sem dependências fora da biblioteca padrão.
"""
from __future__ import annotations

import csv
import html
import json
import pathlib
from collections import Counter
from datetime import date

AQUI = pathlib.Path(__file__).resolve().parent
CSV = AQUI / "tarefas.csv"
HTML = AQUI / "tracker.html"

ORDEM_ESTADO = {"em-curso": 0, "a-fazer": 1, "bloqueado": 2, "feito": 3, "nao-fazer-agora": 4}
ORDEM_PRIO = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "-": 4}


def carregar() -> list[dict[str, str]]:
    with CSV.open(newline="", encoding="utf-8") as f:
        linhas = list(csv.DictReader(f))
    linhas.sort(
        key=lambda r: (
            ORDEM_ESTADO.get(r["estado"], 9),
            ORDEM_PRIO.get(r["prioridade"], 9),
            r["id"],
        )
    )
    return linhas


def página(linhas: list[dict[str, str]]) -> str:
    por_estado = Counter(r["estado"] for r in linhas)
    por_resp = Counter(r["responsavel"] for r in linhas)
    dados = json.dumps(linhas, ensure_ascii=False)

    total = len(linhas)
    feitas = por_estado.get("feito", 0)
    pct = round(feitas / total * 100) if total else 0

    def chip(label: str, n: int, cls: str) -> str:
        return f'<button class="chip {cls}" data-filtro="{html.escape(label)}">{html.escape(label)} <b>{n}</b></button>'

    chips_estado = "".join(
        chip(e, por_estado[e], f"e-{e}")
        for e in sorted(por_estado, key=lambda x: ORDEM_ESTADO.get(x, 9))
    )
    chips_resp = "".join(chip(r, por_resp[r], "r") for r in sorted(por_resp))

    return f"""<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tracker — Janelas Para a Alma</title>
<style>
  :root {{
    --tinta:#182226; --titulo:#0f2b3d; --teal:#1f7a72; --creme:#f6f3ec;
    --linha:#e2ddd0; --suave:#5c6a6f;
  }}
  * {{ box-sizing:border-box; }}
  body {{ font-family:"Georgia","Source Serif 4",serif; color:var(--tinta);
    margin:0; padding:28px 22px 60px; max-width:1100px; margin:0 auto;
    line-height:1.5; background:#fff; }}
  h1 {{ font-family:"Segoe UI","IBM Plex Sans",Arial,sans-serif; color:var(--titulo);
    font-size:20pt; margin:0 0 2px; }}
  .meta {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:8.5pt;
    text-transform:uppercase; letter-spacing:.06em; color:var(--teal); margin:0 0 4px; }}
  .aviso {{ font-size:9pt; color:var(--suave); margin:0 0 16px; }}
  .barra {{ height:8px; background:var(--linha); border-radius:99px; overflow:hidden; margin:10px 0 4px; }}
  .barra i {{ display:block; height:100%; background:var(--teal); width:{pct}%; }}
  .barra-l {{ font-size:9pt; color:var(--suave); margin-bottom:18px; }}
  .filtros {{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }}
  .filtros .grupo-l {{ font-family:"IBM Plex Mono",monospace; font-size:8pt;
    text-transform:uppercase; color:var(--suave); align-self:center; margin-right:2px; }}
  .chip {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:8.5pt; cursor:pointer;
    border:1px solid var(--linha); background:#fff; color:var(--tinta);
    padding:3px 9px; border-radius:99px; }}
  .chip b {{ color:var(--suave); }}
  .chip.on {{ background:var(--titulo); color:#fff; border-color:var(--titulo); }}
  .chip.on b {{ color:#cfe0dd; }}
  #busca {{ font:inherit; font-size:10pt; padding:5px 10px; border:1px solid var(--linha);
    border-radius:6px; margin:8px 0 14px; width:260px; max-width:100%; }}
  table {{ width:100%; border-collapse:collapse; font-size:10pt; }}
  th, td {{ text-align:left; padding:6px 9px; border-bottom:1px solid var(--linha); vertical-align:top; }}
  th {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:8pt; text-transform:uppercase;
    letter-spacing:.04em; color:var(--suave); position:sticky; top:0; background:#fff; }}
  td.id {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:8.5pt; white-space:nowrap; color:var(--suave); }}
  .tag {{ font-family:"IBM Plex Mono",Consolas,monospace; font-size:7.5pt; font-weight:600;
    padding:1px 6px; border-radius:99px; white-space:nowrap; }}
  .est-feito {{ background:#e4efec; color:var(--teal); }}
  .est-em-curso {{ background:#dbe9f6; color:#1f5f8f; }}
  .est-a-fazer {{ background:#f3e6cf; color:#a97a2f; }}
  .est-bloqueado {{ background:#f5e0da; color:#a4432f; }}
  .est-nao-fazer-agora {{ background:#eee; color:#777; }}
  .p0 {{ color:#a4432f; font-weight:700; }}
  .p1 {{ color:#a97a2f; font-weight:600; }}
  .nota {{ color:var(--suave); font-size:9pt; }}
  tr.oculta {{ display:none; }}
  footer {{ margin-top:26px; font-family:"IBM Plex Mono",monospace; font-size:8pt; color:var(--suave); }}
  @media print {{
    .filtros, #busca {{ display:none; }}
    body {{ padding:0; }} th {{ position:static; }}
  }}
</style>
</head>
<body>
<h1>Janelas Para a Alma — Tracker</h1>
<p class="meta">gerado de docs/tarefas.csv · {date.today().isoformat()}</p>
<p class="aviso">Vista só-leitura. Não editar aqui — a fonte é o <code>docs/tarefas.csv</code>
(<code>python docs/gerar_tracker.py</code> volta a gerar este ficheiro).</p>

<div class="barra"><i></i></div>
<p class="barra-l">{feitas}/{total} feitas ({pct}%)</p>

<div class="filtros">
  <span class="grupo-l">estado</span>{chips_estado}
</div>
<div class="filtros">
  <span class="grupo-l">quem</span>{chips_resp}
</div>
<input id="busca" type="search" placeholder="procurar tarefa, id, nota…">

<table id="t">
  <thead><tr>
    <th>id</th><th>tarefa</th><th>prio</th><th>estado</th><th>quem</th><th>sprint</th><th>actualizado</th><th>notas</th>
  </tr></thead>
  <tbody></tbody>
</table>

<footer>Janelas Para a Alma · reescrita de infraestrutura</footer>

<script>
const DADOS = {dados};
const tbody = document.querySelector('#t tbody');
const filtros = new Set();

function esc(s) {{ const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }}

function render() {{
  const q = (document.querySelector('#busca').value || '').toLowerCase();
  tbody.innerHTML = DADOS.map(r => {{
    const passaFiltro = [...filtros].every(f => r.estado === f || r.responsavel === f);
    const alvo = (r.id + ' ' + r.tarefa + ' ' + r.notas + ' ' + r.sprint).toLowerCase();
    const oculta = (!passaFiltro || (q && !alvo.includes(q))) ? ' class="oculta"' : '';
    const prioCls = r.prioridade === 'P0' ? 'p0' : r.prioridade === 'P1' ? 'p1' : '';
    return `<tr${{oculta}}>
      <td class="id">${{esc(r.id)}}</td>
      <td>${{esc(r.tarefa)}}</td>
      <td class="${{prioCls}}">${{esc(r.prioridade)}}</td>
      <td><span class="tag est-${{esc(r.estado)}}">${{esc(r.estado)}}</span></td>
      <td>${{esc(r.responsavel)}}</td>
      <td>${{esc(r.sprint)}}</td>
      <td>${{esc(r.atualizado)}}</td>
      <td class="nota">${{esc(r.notas)}}</td>
    </tr>`;
  }}).join('');
}}

document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {{
  const f = c.dataset.filtro;
  if (filtros.has(f)) {{ filtros.delete(f); c.classList.remove('on'); }}
  else {{ filtros.add(f); c.classList.add('on'); }}
  render();
}}));
document.querySelector('#busca').addEventListener('input', render);
render();
</script>
</body>
</html>
"""


def main() -> None:
    linhas = carregar()
    HTML.write_text(página(linhas), encoding="utf-8")
    print(f"tracker.html gerado — {len(linhas)} tarefas")


if __name__ == "__main__":
    main()
