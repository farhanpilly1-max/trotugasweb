'use strict';
// ============================================================
// grafik.js  —  Metode Grafik LP (2 variabel, maks 20 batasan)
// History: klik item → modal menampilkan ulang PERSIS sama
// ============================================================

var GS = { objective: 'max', numCons: 2 };
var GHKEY = 'tro_grafik_history';

var GCOLORS = [
  '#c9a84c','#60a5fa','#4ade80','#f87171','#a78bfa',
  '#fb923c','#34d399','#f472b6','#38bdf8','#facc15',
  '#84cc16','#e879f9','#2dd4bf','#fb7185','#818cf8',
  '#fbbf24','#a3e635','#c084fc','#67e8f9','#f9a8d4'
];

var CON_DEFS = [
  [6,4,'le',24],[1,2,'le',6],[0,1,'le',4],[1,0,'le',5],
  [2,1,'le',10],[3,2,'le',18],[1,3,'le',9],[4,1,'le',16],
  [1,1,'le',7],[2,3,'le',15],[1,2,'ge',2],[3,1,'le',12],
  [2,2,'le',14],[1,4,'le',16],[5,2,'le',20],[1,1,'ge',1],
  [3,3,'le',18],[2,5,'le',20],[4,3,'le',24],[1,0,'le',8]
];

// ── INIT ─────────────────────────────────────────────────────
function initGrafik() {
  renderGCons();
  renderGHistory();
}

function setGObj(t) {
  GS.objective = t;
  document.getElementById('btnMax').classList.toggle('active', t === 'max');
  document.getElementById('btnMin').classList.toggle('active', t === 'min');
}

function addGCon() {
  if (GS.numCons >= 20) { alert('Maksimal 20 batasan.'); return; }
  GS.numCons++;
  document.getElementById('grafikConCount').textContent = GS.numCons;
  renderGCons();
}
function removeGCon() {
  if (GS.numCons <= 1) { alert('Minimal 1 batasan.'); return; }
  GS.numCons--;
  document.getElementById('grafikConCount').textContent = GS.numCons;
  renderGCons();
}

function renderGCons() {
  var wrap = document.getElementById('grafikCons');
  wrap.innerHTML = '';
  for (var j = 0; j < GS.numCons; j++) {
    var d = CON_DEFS[j] || [1,1,'le',10];
    var color = GCOLORS[j % GCOLORS.length];
    var row = document.createElement('div');
    row.className = 'con-row';
    row.innerHTML =
      '<div class="con-badge" style="background:' + color + '">C' + (j+1) + '</div>' +
      '<input type="number" id="gc_a' + j + '" value="' + d[0] + '" class="coef-g"/>' +
      '<span style="font-size:14px;color:var(--gold-light);font-style:italic;">x<sub>1</sub></span>' +
      '<span style="color:var(--muted);font-size:15px;padding:0 2px;">+</span>' +
      '<input type="number" id="gc_b' + j + '" value="' + d[1] + '" class="coef-g"/>' +
      '<span style="font-size:14px;color:var(--gold-light);font-style:italic;">x<sub>2</sub></span>' +
      buildSel('gc_s'+j, d[2]) +
      '<input type="number" id="gc_r' + j + '" value="' + d[3] + '" class="coef-g rhs-g"/>';
    wrap.appendChild(row);
  }
}

function buildSel(id, sel) {
  return '<select id="' + id + '" class="sign-g">' +
    '<option value="le"' + (sel==='le'?' selected':'') + '>≤</option>' +
    '<option value="ge"' + (sel==='ge'?' selected':'') + '>≥</option>' +
    '<option value="eq"' + (sel==='eq'?' selected':'') + '>=</option>' +
    '</select>';
}

// ── SOLVER ───────────────────────────────────────────────────
function solveGrafik() {
  var isMax = GS.objective === 'max';
  var c1 = pf('g_c1'), c2 = pf('g_c2');
  var cons = readCons();

  var candidates = buildCandidates(cons);
  var corners = filterFeasible(candidates, cons);

  if (!corners.length) {
    document.getElementById('grafikResult').innerHTML =
      '<div class="step-block" style="margin-top:24px;"><div class="step-header">⚠️ Tidak Ada Daerah Fisibel</div>' +
      '<p class="s-explain">Tidak ditemukan titik yang memenuhi semua batasan sekaligus. Periksa kembali nilai koefisien dan RHS.</p></div>';
    return;
  }

  // Evaluate Z
  var evaluated = corners.map(function(p) {
    return { x1: p[0], x2: p[1], z: c1*p[0] + c2*p[1] };
  });
  var optZ = isMax
    ? Math.max.apply(null, evaluated.map(function(e){ return e.z; }))
    : Math.min.apply(null, evaluated.map(function(e){ return e.z; }));
  var optPt = evaluated.filter(function(e){ return Math.abs(e.z - optZ) < 1e-6; })[0];

  // Sort corners by angle for polygon drawing
  var cx = corners.reduce(function(s,p){ return s+p[0]; },0) / corners.length;
  var cy2 = corners.reduce(function(s,p){ return s+p[1]; },0) / corners.length;
  corners.sort(function(a,b){
    return Math.atan2(a[1]-cy2, a[0]-cx) - Math.atan2(b[1]-cy2, b[0]-cx);
  });

  // Build the result HTML (identical structure for both live + modal)
  var resultHtml = buildResultHtml(isMax, c1, c2, cons, corners, evaluated, optPt);

  // Inject into page
  var resultEl = document.getElementById('grafikResult');
  resultEl.innerHTML = resultHtml;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Draw canvases after DOM is ready
  setTimeout(function() {
    drawX1Chart('chartX1', cons, optPt);
    drawX2Chart('chartX2', cons, optPt);
    drawMainChart('chartMain', cons, corners, evaluated, optPt, c1, c2, isMax);
  }, 60);

  // Save to history — store full state so we can replay
  var entry = {
    method: 'Grafik',
    type: isMax ? 'Maksimasi' : 'Minimasi',
    objective: fN(c1) + 'x₁ + ' + fN(c2) + 'x₂',
    constraints: cons.map(function(c) {
      return fN(c.a) + 'x₁ + ' + fN(c.b) + 'x₂ ' + signStr(c.sign) + ' ' + fN(c.rhs);
    }),
    result: { x1: optPt.x1, x2: optPt.x2, z: optPt.z },
    // Full state to replay
    _state: { isMax: isMax, c1: c1, c2: c2, cons: cons, corners: corners, evaluated: evaluated, optPt: optPt },
    // Full HTML stored for instant replay
    _html: resultHtml
  };
  saveGH(entry);
  renderGHistory();
}

// ── READ INPUTS ───────────────────────────────────────────────
function readCons() {
  var cons = [];
  for (var j = 0; j < GS.numCons; j++) {
    cons.push({
      a: pf('gc_a'+j), b: pf('gc_b'+j),
      sign: document.getElementById('gc_s'+j).value,
      rhs: pf('gc_r'+j), idx: j
    });
  }
  return cons;
}

function buildCandidates(cons) {
  var cands = [[0,0]];
  for (var j = 0; j < cons.length; j++) {
    var c = cons[j];
    if (Math.abs(c.a) > 1e-9) cands.push([c.rhs/c.a, 0]);
    if (Math.abs(c.b) > 1e-9) cands.push([0, c.rhs/c.b]);
    for (var k = j+1; k < cons.length; k++) {
      var pt = intersect2(c.a, c.b, c.rhs, cons[k].a, cons[k].b, cons[k].rhs);
      if (pt) cands.push(pt);
    }
  }
  return cands;
}

function filterFeasible(cands, cons) {
  var result = [];
  for (var i = 0; i < cands.length; i++) {
    var p = cands[i];
    if (p[0] < -1e-6 || p[1] < -1e-6) continue;
    var ok = true;
    for (var j = 0; j < cons.length; j++) {
      if (!isSat(cons[j], p[0], p[1])) { ok = false; break; }
    }
    if (!ok) continue;
    // Deduplicate
    var dup = false;
    for (var k = 0; k < result.length; k++) {
      if (Math.abs(p[0]-result[k][0])<1e-6 && Math.abs(p[1]-result[k][1])<1e-6) { dup=true; break; }
    }
    if (!dup) result.push([Math.max(0,r4(p[0])), Math.max(0,r4(p[1]))]);
  }
  return result;
}

// ── BUILD HTML ────────────────────────────────────────────────
function buildResultHtml(isMax, c1, c2, cons, corners, evaluated, optPt) {
  var html = '<div class="result-section">';
  var sn = 0;

  // Summary card (shown first above steps)
  html += '<div class="result-summary">' +
    '<div class="res-title">✅ Solusi Optimal Ditemukan!</div>' +
    '<div class="res-vars">' +
    '<div class="res-var"><span>x₁</span><strong>' + fN(optPt.x1) + '</strong></div>' +
    '<div class="res-var"><span>x₂</span><strong>' + fN(optPt.x2) + '</strong></div>' +
    '</div>' +
    '<div class="res-z">Nilai ' + (isMax?'Maksimum':'Minimum') + ' Z = <strong>' + fN(optPt.z) + '</strong></div>' +
    '</div>';

  html += '<div class="steps-title">Langkah-langkah Penyelesaian</div>';

  // ── STEP 1: Formulasi ──
  sn++;
  var consHtml = '';
  for (var j = 0; j < cons.length; j++) {
    var c = cons[j], col = GCOLORS[j%GCOLORS.length];
    consHtml += '<div class="mrow con">' +
      '<span class="cdot" style="background:' + col + ';"></span>' +
      '<strong>C' + (j+1) + ':</strong>&nbsp;&nbsp;' +
      fN(c.a) + 'x<sub>1</sub> + ' + fN(c.b) + 'x<sub>2</sub>' +
      ' <span class="iq">&nbsp;' + signStr(c.sign) + '&nbsp;</span>' +
      '<span class="rv">' + fN(c.rhs) + '</span></div>';
  }
  html += wB(sn, 'Formulasi Model Program Linier',
    '<p class="s-explain">Nyatakan masalah optimasi dalam bentuk matematis yang jelas — fungsi tujuan dan semua batasan.</p>' +
    '<div class="mbox">' +
    '<div class="mrow goal">' + (isMax?'Maks':'Min') + ' Z = ' + fN(c1) + 'x<sub>1</sub> + ' + fN(c2) + 'x<sub>2</sub></div>' +
    '<div class="mrow lbl">Batasan (Subject to):</div>' +
    consHtml +
    '<div class="mrow noneg">x<sub>1</sub> ≥ 0 &nbsp;&nbsp; x<sub>2</sub> ≥ 0 &nbsp; (non-negativitas)</div>' +
    '</div>');

  // ── STEP 2: Garis batasan ──
  sn++;
  var lineHtml = '<div class="mrow note">Untuk menggambar setiap garis, ubah ≤/≥ menjadi = lalu cari dua titik: ' +
    'saat x<sub>1</sub>=0 dan saat x<sub>2</sub>=0.</div>';
  for (var j = 0; j < cons.length; j++) {
    var c = cons[j], col = GCOLORS[j%GCOLORS.length];
    var xi1 = Math.abs(c.a)>1e-9 ? fN(c.rhs/c.a) : '—';
    var xi2 = Math.abs(c.b)>1e-9 ? fN(c.rhs/c.b) : '—';
    var lineExpr = '';
    if (Math.abs(c.b)>1e-9) {
      var sl = -c.a/c.b, ic = c.rhs/c.b;
      lineExpr = 'x<sub>2</sub> = ' + fN(ic) + (sl>=0?' + ':' − ') + fN(Math.abs(sl)) + 'x<sub>1</sub>';
    } else if (Math.abs(c.a)>1e-9) {
      lineExpr = 'x<sub>1</sub> = ' + fN(c.rhs/c.a) + ' (garis vertikal)';
    }
    lineHtml +=
      '<div class="mrow lbl" style="margin-top:10px;"><span class="cdot" style="background:' + col + ';"></span>Batasan C' + (j+1) + '</div>' +
      '<div class="mrow con ind">' + fN(c.a) + 'x<sub>1</sub> + ' + fN(c.b) + 'x<sub>2</sub> = ' + fN(c.rhs) + ' &nbsp;→&nbsp; ' + lineExpr + '</div>' +
      '<div class="mrow note ind">Potong sumbu x<sub>1</sub> (x<sub>2</sub>=0): <strong>(' + xi1 + ', 0)</strong> &nbsp;&nbsp; Potong sumbu x<sub>2</sub> (x<sub>1</sub>=0): <strong>(0, ' + xi2 + ')</strong></div>';
  }
  html += wB(sn, 'Mengubah Batasan ke Persamaan Garis', '<div class="mbox">' + lineHtml + '</div>');

  // ── STEP 3: Tabel titik potong sumbu ──
  sn++;
  var tblHtml = '<div class="table-wrap"><table class="corner-table">' +
    '<thead><tr><th>Batasan</th><th>Persamaan Garis</th><th>Potong Sumbu x<sub>1</sub></th><th>Potong Sumbu x<sub>2</sub></th></tr></thead><tbody>';
  for (var j = 0; j < cons.length; j++) {
    var c = cons[j], col = GCOLORS[j%GCOLORS.length];
    var xi1 = Math.abs(c.a)>1e-9 ? fN(c.rhs/c.a) : '—';
    var xi2 = Math.abs(c.b)>1e-9 ? fN(c.rhs/c.b) : '—';
    tblHtml += '<tr><td><span class="cdot" style="background:' + col + ';"></span>C' + (j+1) + '</td>' +
      '<td>' + fN(c.a) + 'x<sub>1</sub> + ' + fN(c.b) + 'x<sub>2</sub> ' + signStr(c.sign) + ' ' + fN(c.rhs) + '</td>' +
      '<td>(' + xi1 + ', 0)</td><td>(0, ' + xi2 + ')</td></tr>';
  }
  tblHtml += '</tbody></table></div>';
  html += wB(sn, 'Tabel Titik Potong Sumbu Setiap Batasan',
    '<p class="s-explain">Dua titik cukup untuk menggambar satu garis lurus. Titik potong sumbu adalah titik termudah untuk dihitung.</p>' + tblHtml);

  // ── STEP 4: Grafik x1 ──
  sn++;
  html += wB(sn, 'Grafik Proyeksi — Titik Potong Sumbu x<sub>1</sub>',
    '<p class="s-explain">Tampilkan nilai titik potong setiap batasan pada sumbu x<sub>1</sub> (ketika x<sub>2</sub>=0). Garis hijau = nilai optimal x<sub>1</sub>.</p>' +
    '<div class="graph-wrap"><canvas id="chartX1" height="180"></canvas></div>');

  // ── STEP 5: Grafik x2 ──
  sn++;
  html += wB(sn, 'Grafik Proyeksi — Titik Potong Sumbu x<sub>2</sub>',
    '<p class="s-explain">Tampilkan nilai titik potong setiap batasan pada sumbu x<sub>2</sub> (ketika x<sub>1</sub>=0). Garis hijau = nilai optimal x<sub>2</sub>.</p>' +
    '<div class="graph-wrap"><canvas id="chartX2" height="180"></canvas></div>');

  // ── STEP 6: Titik sudut ──
  sn++;
  var sortedEval = evaluated.slice().sort(function(a,b){ return a.x1-b.x1; });
  var cornerRows = '';
  for (var i = 0; i < sortedEval.length; i++) {
    var e = sortedEval[i];
    var isOpt = Math.abs(e.z-optPt.z)<1e-6 && Math.abs(e.x1-optPt.x1)<1e-6;
    cornerRows += '<tr' + (isOpt?' class="opt-row"':'') + '>' +
      '<td><strong>(' + fN(e.x1) + ', ' + fN(e.x2) + ')</strong></td>' +
      '<td>' + fN(c1) + '×' + fN(e.x1) + ' + ' + fN(c2) + '×' + fN(e.x2) +
        ' = ' + fN(c1*e.x1) + ' + ' + fN(c2*e.x2) + ' = <strong>' + fN(e.z) + '</strong></td>' +
      '<td>' + (isOpt ? '<span class="opt-badge">← ' + (isMax?'Maks':'Min') + ' ✓</span>' : '') + '</td></tr>';
  }
  html += wB(sn, 'Evaluasi Titik Sudut Daerah Fisibel',
    '<p class="s-explain"><strong>Teorema Titik Sudut:</strong> Solusi optimal program linier selalu berada di salah satu titik sudut (vertex) daerah fisibel. Hitung Z di setiap titik sudut, ambil nilai ' + (isMax?'terbesar':'terkecil') + '.</p>' +
    '<div class="mbox" style="margin-bottom:14px;">' +
    '<div class="mrow note">Fungsi tujuan: Z = ' + fN(c1) + 'x<sub>1</sub> + ' + fN(c2) + 'x<sub>2</sub> &nbsp;·&nbsp; Jumlah titik sudut: <strong>' + evaluated.length + '</strong></div>' +
    '</div>' +
    '<div class="table-wrap"><table class="corner-table">' +
    '<thead><tr><th>Titik Sudut (x<sub>1</sub>, x<sub>2</sub>)</th><th>Perhitungan Z</th><th>Status</th></tr></thead>' +
    '<tbody>' + cornerRows + '</tbody></table></div>');

  // ── STEP 7: Grafik gabungan ──
  sn++;
  html += wB(sn, 'Grafik Gabungan — Daerah Fisibel &amp; Solusi Optimal',
    '<p class="s-explain">Seluruh garis batasan, daerah fisibel (diarsir), titik-titik sudut, dan garis fungsi tujuan optimal ditampilkan dalam satu bidang koordinat x<sub>1</sub>–x<sub>2</sub>.</p>' +
    '<div class="graph-wrap"><canvas id="chartMain" height="500"></canvas></div>' +
    '<div id="chartLegend" class="legend-grid" style="margin-top:14px;"></div>');

  // ── STEP 8: Verifikasi ──
  sn++;
  var verHtml = '<div class="mrow lbl">1. Substitusi ke Fungsi Tujuan:</div>' +
    '<div class="mrow con ind">Z = ' + fN(c1) + ' × ' + fN(optPt.x1) + ' + ' + fN(c2) + ' × ' + fN(optPt.x2) +
    ' = ' + fN(c1*optPt.x1) + ' + ' + fN(c2*optPt.x2) + ' = <strong>' + fN(optPt.z) + '</strong> ✅</div>' +
    '<div class="mrow lbl" style="margin-top:12px;">2. Verifikasi semua batasan:</div>';
  for (var j = 0; j < cons.length; j++) {
    var c = cons[j];
    var lhs = c.a*optPt.x1 + c.b*optPt.x2;
    var ok = isSat(c, optPt.x1, optPt.x2);
    verHtml += '<div class="mrow con ind">C' + (j+1) + ': ' +
      fN(c.a) + '×' + fN(optPt.x1) + ' + ' + fN(c.b) + '×' + fN(optPt.x2) +
      ' = ' + fN(lhs) + ' ' + signStr(c.sign) + ' ' + fN(c.rhs) + ' ' + (ok?'✅':'⚠️') + '</div>';
  }
  verHtml += '<div class="mrow con ind">x<sub>1</sub> = ' + fN(optPt.x1) + ' ≥ 0 ✅ &nbsp;&nbsp; x<sub>2</sub> = ' + fN(optPt.x2) + ' ≥ 0 ✅</div>' +
    '<div class="mrow ok" style="margin-top:10px;">✅ Solusi optimal valid! &nbsp; x<sub>1</sub> = ' + fN(optPt.x1) + ', &nbsp; x<sub>2</sub> = ' + fN(optPt.x2) + ', &nbsp; Z = ' + fN(optPt.z) + '</div>';
  html += wB(sn, 'Verifikasi Solusi',
    '<p class="s-explain">Substitusikan nilai optimal ke fungsi tujuan dan semua batasan untuk memastikan solusi valid dan layak (feasible).</p>' +
    '<div class="mbox">' + verHtml + '</div>');

  // Transfer panel
  html += '<div class="xfer-panel">' +
    '<div class="xfer-title">↔ Gunakan Data Ini di Metode Lain</div>' +
    '<div class="xfer-row">' +
    '<button class="btn-xfer" onclick="xferToSimplex()">📊 Selesaikan dengan Metode Simplex</button>' +
    '</div></div>';

  html += '</div>'; // end result-section
  return html;
}

// ── CHART X1 ─────────────────────────────────────────────────
function drawX1Chart(canvasId, cons, optPt) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width = canvas.offsetWidth || 600;
  var H = canvas.height = 180;
  var vals = cons.filter(function(c){ return Math.abs(c.a)>1e-9; }).map(function(c){ return c.rhs/c.a; });
  vals.push(optPt.x1, 0);
  var maxV = Math.max.apply(null, vals) * 1.35 || 10;
  var pad = {l:55,r:20,t:46,b:36};
  var cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  var midY = pad.t + cH/2;
  function tx(v){ return pad.l + (v/maxV)*cW; }

  ctx.fillStyle='#080e1a'; ctx.fillRect(0,0,W,H);
  // grid
  ctx.strokeStyle='rgba(201,168,76,0.07)'; ctx.lineWidth=1;
  for(var i=0;i<=6;i++){ var gx=tx(i*maxV/6); ctx.beginPath(); ctx.moveTo(gx,pad.t); ctx.lineTo(gx,pad.t+cH); ctx.stroke(); }
  // axis
  ctx.strokeStyle='rgba(201,168,76,0.45)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.l,midY); ctx.lineTo(pad.l+cW,midY); ctx.stroke();
  // tick labels
  ctx.fillStyle='rgba(201,168,76,0.5)'; ctx.font='11px JetBrains Mono,monospace'; ctx.textAlign='center';
  for(var i=0;i<=6;i++) ctx.fillText(fN(i*maxV/6), tx(i*maxV/6), midY+16);
  ctx.fillStyle='#e8c97a'; ctx.font='11px DM Sans,sans-serif';
  ctx.fillText('Sumbu x₁', pad.l+cW/2, H-5);
  // title
  ctx.fillStyle='rgba(232,201,122,0.8)'; ctx.font='bold 11px DM Sans'; ctx.textAlign='left';
  ctx.fillText('Proyeksi Titik Potong Sumbu x₁', pad.l, pad.t-14);
  // constraint ticks
  for(var j=0;j<cons.length;j++){
    if(Math.abs(cons[j].a)<1e-9) continue;
    var xi=cons[j].rhs/cons[j].a; if(xi<0||xi>maxV*1.1) continue;
    var col=GCOLORS[j%GCOLORS.length], x=tx(xi);
    ctx.strokeStyle=col; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x,midY-22); ctx.lineTo(x,midY+22); ctx.stroke();
    ctx.fillStyle=col; ctx.font='bold 11px DM Sans'; ctx.textAlign='center';
    ctx.fillText('C'+(j+1),x,midY-28);
    ctx.fillStyle='rgba(236,233,224,0.8)'; ctx.font='10px JetBrains Mono';
    ctx.fillText(fN(xi),x,midY-40);
  }
  // optimal
  var xo=tx(optPt.x1);
  ctx.strokeStyle='#4ade80'; ctx.lineWidth=2.5;
  ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(xo,pad.t); ctx.lineTo(xo,pad.t+cH); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#4ade80'; ctx.font='bold 11px DM Sans'; ctx.textAlign='center';
  ctx.fillText('x₁* = '+fN(optPt.x1), xo, pad.t+11);
}

// ── CHART X2 ─────────────────────────────────────────────────
function drawX2Chart(canvasId, cons, optPt) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width = canvas.offsetWidth || 600;
  var H = canvas.height = 180;
  var vals = cons.filter(function(c){ return Math.abs(c.b)>1e-9; }).map(function(c){ return c.rhs/c.b; });
  vals.push(optPt.x2, 0);
  var maxV = Math.max.apply(null, vals) * 1.35 || 10;
  var pad = {l:55,r:20,t:46,b:36};
  var cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  var midY = pad.t + cH/2;
  function tx(v){ return pad.l + (v/maxV)*cW; }

  ctx.fillStyle='#080e1a'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(201,168,76,0.07)'; ctx.lineWidth=1;
  for(var i=0;i<=6;i++){ var gx=tx(i*maxV/6); ctx.beginPath(); ctx.moveTo(gx,pad.t); ctx.lineTo(gx,pad.t+cH); ctx.stroke(); }
  ctx.strokeStyle='rgba(201,168,76,0.45)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.l,midY); ctx.lineTo(pad.l+cW,midY); ctx.stroke();
  ctx.fillStyle='rgba(201,168,76,0.5)'; ctx.font='11px JetBrains Mono'; ctx.textAlign='center';
  for(var i=0;i<=6;i++) ctx.fillText(fN(i*maxV/6), tx(i*maxV/6), midY+16);
  ctx.fillStyle='#e8c97a'; ctx.font='11px DM Sans';
  ctx.fillText('Sumbu x₂', pad.l+cW/2, H-5);
  ctx.fillStyle='rgba(232,201,122,0.8)'; ctx.font='bold 11px DM Sans'; ctx.textAlign='left';
  ctx.fillText('Proyeksi Titik Potong Sumbu x₂', pad.l, pad.t-14);
  for(var j=0;j<cons.length;j++){
    if(Math.abs(cons[j].b)<1e-9) continue;
    var xi=cons[j].rhs/cons[j].b; if(xi<0||xi>maxV*1.1) continue;
    var col=GCOLORS[j%GCOLORS.length], x=tx(xi);
    ctx.strokeStyle=col; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x,midY-22); ctx.lineTo(x,midY+22); ctx.stroke();
    ctx.fillStyle=col; ctx.font='bold 11px DM Sans'; ctx.textAlign='center';
    ctx.fillText('C'+(j+1),x,midY-28);
    ctx.fillStyle='rgba(236,233,224,0.8)'; ctx.font='10px JetBrains Mono';
    ctx.fillText(fN(xi),x,midY-40);
  }
  var xo=tx(optPt.x2);
  ctx.strokeStyle='#4ade80'; ctx.lineWidth=2.5;
  ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(xo,pad.t); ctx.lineTo(xo,pad.t+cH); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#4ade80'; ctx.font='bold 11px DM Sans'; ctx.textAlign='center';
  ctx.fillText('x₂* = '+fN(optPt.x2), xo, pad.t+11);
}

// ── CHART MAIN ────────────────────────────────────────────────
function drawMainChart(canvasId, cons, corners, evaluated, optPt, c1, c2, isMax) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width = canvas.offsetWidth || 600;
  var H = canvas.height = 500;

  var allX = corners.map(function(c){ return c[0]; });
  var allY = corners.map(function(c){ return c[1]; });
  cons.forEach(function(c){
    if(Math.abs(c.a)>1e-9) allX.push(c.rhs/c.a);
    if(Math.abs(c.b)>1e-9) allY.push(c.rhs/c.b);
  });
  var maxX = Math.max.apply(null, allX.concat([optPt.x1,1])) * 1.3;
  var maxY = Math.max.apply(null, allY.concat([optPt.x2,1])) * 1.3;
  var pad = {l:55,r:24,t:28,b:50};
  var cW = W-pad.l-pad.r, cH = H-pad.t-pad.b;
  function sx(v){ return pad.l + (v/maxX)*cW; }
  function sy(v){ return pad.t + cH - (v/maxY)*cH; }

  ctx.fillStyle='#080e1a'; ctx.fillRect(0,0,W,H);

  // grid
  var stX = niceStep(maxX,7), stY = niceStep(maxY,7);
  ctx.strokeStyle='rgba(201,168,76,0.06)'; ctx.lineWidth=1;
  for(var x=stX;x<=maxX;x+=stX){ ctx.beginPath(); ctx.moveTo(sx(x),pad.t); ctx.lineTo(sx(x),pad.t+cH); ctx.stroke(); }
  for(var y=stY;y<=maxY;y+=stY){ ctx.beginPath(); ctx.moveTo(pad.l,sy(y)); ctx.lineTo(pad.l+cW,sy(y)); ctx.stroke(); }

  // feasible polygon
  if(corners.length>=3){
    ctx.beginPath(); ctx.moveTo(sx(corners[0][0]),sy(corners[0][1]));
    for(var i=1;i<corners.length;i++) ctx.lineTo(sx(corners[i][0]),sy(corners[i][1]));
    ctx.closePath();
    ctx.fillStyle='rgba(201,168,76,0.14)'; ctx.fill();
    ctx.strokeStyle='rgba(201,168,76,0.28)'; ctx.lineWidth=1.5; ctx.stroke();
  }

  // constraint lines
  for(var j=0;j<cons.length;j++){
    var c=cons[j], col=GCOLORS[j%GCOLORS.length];
    var pts=[];
    if(Math.abs(c.b)>1e-9){
      pts.push([0,c.rhs/c.b],[maxX,(c.rhs-c.a*maxX)/c.b]);
    } else if(Math.abs(c.a)>1e-9){
      pts.push([c.rhs/c.a,0],[c.rhs/c.a,maxY]);
    } else continue;
    pts=pts.filter(function(p){ return p[0]>=-0.01&&p[1]>=-0.01&&p[0]<=maxX*1.05&&p[1]<=maxY*1.05; });
    if(pts.length<2) continue;
    ctx.strokeStyle=col; ctx.lineWidth=2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(sx(pts[0][0]),sy(pts[0][1])); ctx.lineTo(sx(pts[1][0]),sy(pts[1][1])); ctx.stroke();
    var lx=Math.max(0,Math.min(maxX,pts[0][0]*0.5+pts[1][0]*0.5));
    var ly=Math.max(0,Math.min(maxY,pts[0][1]*0.5+pts[1][1]*0.5));
    ctx.fillStyle=col; ctx.font='bold 11px DM Sans'; ctx.textAlign='left';
    ctx.fillText('C'+(j+1), sx(lx)+5, sy(ly)-5);
  }

  // optimal Z line
  var zOpt=c1*optPt.x1+c2*optPt.x2;
  if(Math.abs(c2)>1e-9){
    ctx.setLineDash([10,5]); ctx.strokeStyle='rgba(74,222,128,0.85)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(sx(0),sy(zOpt/c2)); ctx.lineTo(sx(maxX),sy((zOpt-c1*maxX)/c2)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#4ade80'; ctx.font='bold 12px DM Sans'; ctx.textAlign='left';
    ctx.fillText('Z* = '+fN(zOpt), sx(0)+6, sy(zOpt/c2)-8);
  } else if(Math.abs(c1)>1e-9){
    var xz=zOpt/c1;
    ctx.setLineDash([10,5]); ctx.strokeStyle='rgba(74,222,128,0.85)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(sx(xz),sy(0)); ctx.lineTo(sx(xz),sy(maxY)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // axes
  ctx.strokeStyle='rgba(201,168,76,0.55)'; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t+cH); ctx.lineTo(pad.l+cW+8,pad.t+cH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t+cH); ctx.lineTo(pad.l,pad.t-4); ctx.stroke();

  // axis labels + ticks
  ctx.fillStyle='#e8c97a'; ctx.font='bold 13px DM Sans';
  ctx.textAlign='center'; ctx.fillText('x₁', pad.l+cW+16, pad.t+cH+4);
  ctx.fillText('x₂', pad.l-4, pad.t-10);
  ctx.fillStyle='rgba(201,168,76,0.55)'; ctx.font='11px JetBrains Mono';
  for(var x=stX;x<=maxX;x+=stX){ ctx.textAlign='center'; ctx.fillText(fN(x),sx(x),pad.t+cH+16); }
  for(var y=stY;y<=maxY;y+=stY){ ctx.textAlign='right'; ctx.fillText(fN(y),pad.l-6,sy(y)+4); }

  // corner points
  evaluated.forEach(function(e){
    var isOpt=Math.abs(e.z-optPt.z)<1e-6&&Math.abs(e.x1-optPt.x1)<1e-6;
    var px=sx(e.x1), py=sy(e.x2);
    if(isOpt){
      ctx.beginPath(); ctx.arc(px,py,13,0,Math.PI*2);
      ctx.strokeStyle='rgba(74,222,128,0.25)'; ctx.lineWidth=2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(px,py,isOpt?8:5,0,Math.PI*2);
    ctx.fillStyle=isOpt?'#4ade80':'#c9a84c'; ctx.fill();
    ctx.strokeStyle='#080e1a'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle=isOpt?'#4ade80':'rgba(232,201,122,0.8)';
    ctx.font=(isOpt?'bold ':'')+' 11px DM Sans'; ctx.textAlign='left';
    ctx.fillText('('+fN(e.x1)+', '+fN(e.x2)+')', px+10, py-5);
    if(isOpt) ctx.fillText('Z='+fN(e.z)+' ★', px+10, py+10);
  });

  // Legend
  var leg=document.getElementById('chartLegend');
  if(leg){
    var lh='';
    for(var j=0;j<cons.length;j++){
      var c=cons[j];
      lh+='<div class="legend-item"><span class="legend-swatch" style="background:'+GCOLORS[j%GCOLORS.length]+';"></span>C'+(j+1)+': '+fN(c.a)+'x₁+'+fN(c.b)+'x₂ '+signStr(c.sign)+' '+fN(c.rhs)+'</div>';
    }
    lh+='<div class="legend-item"><span class="legend-dot-sm" style="background:#4ade80;"></span>Z* = '+fN(zOpt)+'</div>';
    lh+='<div class="legend-item"><span class="legend-swatch" style="background:rgba(201,168,76,0.4);height:10px;"></span>Daerah Fisibel</div>';
    leg.innerHTML=lh;
  }
}

// ── HISTORY ───────────────────────────────────────────────────
function getGH() {
  try { return JSON.parse(localStorage.getItem(GHKEY)||'[]'); } catch(e){ return []; }
}
function saveGH(entry) {
  try {
    var h=getGH();
    entry.id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    entry.timestamp=new Date().toISOString();
    h.unshift(entry);
    if(h.length>50) h.length=50;
    localStorage.setItem(GHKEY,JSON.stringify(h));
  } catch(e){}
}
function deleteGH(id) {
  var h=getGH().filter(function(e){ return e.id!==id; });
  localStorage.setItem(GHKEY,JSON.stringify(h));
  renderGHistory();
}
function clearGH() {
  if(!confirm('Hapus semua riwayat grafik?')) return;
  localStorage.removeItem(GHKEY);
  renderGHistory();
}
function downloadGH() {
  var h=getGH();
  if(!h.length){ alert('Belum ada riwayat.'); return; }
  var txt='═══════════════════════════════════════\n     TRO — Riwayat Metode Grafik\n     Diekspor: '+new Date().toLocaleString('id-ID')+'\n═══════════════════════════════════════\n\n';
  h.forEach(function(e,i){
    txt+='['+( i+1)+'] '+e.type+' — '+new Date(e.timestamp).toLocaleString('id-ID')+'\n';
    txt+='    Z = '+e.objective+'\n';
    if(e.constraints) e.constraints.forEach(function(c){ txt+='    '+c+'\n'; });
    if(e.result){ txt+='    x₁='+e.result.x1.toFixed(4)+', x₂='+e.result.x2.toFixed(4)+', Z='+e.result.z.toFixed(4)+'\n'; }
    txt+='\n';
  });
  var blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download='TRO_Grafik_'+new Date().toISOString().slice(0,10)+'.txt'; a.click();
  URL.revokeObjectURL(url);
}

function renderGHistory() {
  var container=document.getElementById('grafikHistory');
  var actionsEl=document.getElementById('gHistActions');
  if(!container) return;
  var h=getGH();

  if(!h.length){
    container.innerHTML='<div class="g-history-empty">Belum ada riwayat. Selesaikan perhitungan pertama.</div>';
    if(actionsEl) actionsEl.innerHTML='';
    return;
  }

  if(actionsEl){
    actionsEl.innerHTML=
      '<button class="btn-hist-action btn-dl" onclick="downloadGH()">⬇ Unduh .txt</button>' +
      '<button class="btn-hist-action btn-clr" onclick="clearGH()">🗑 Hapus Semua</button>';
  }

  var html='<div class="g-history-list">';
  h.forEach(function(e){
    var t=new Date(e.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    var zStr=e.result?'Z = '+e.result.z.toFixed(3):'';
    html+=
      '<div class="g-hist-item" onclick="openGHModal(\''+e.id+'\')">' +
      '<div class="g-hist-icon">📈</div>' +
      '<div class="g-hist-body">' +
        '<div class="g-hist-title">'+e.type+' — Z = '+e.objective+'</div>' +
        '<div class="g-hist-meta">'+t+'&nbsp;&nbsp;·&nbsp;&nbsp;'+(e.constraints?e.constraints.length:0)+' batasan</div>' +
      '</div>' +
      (zStr?'<div class="g-hist-z">'+zStr+'</div>':'') +
      '<button class="g-hist-del" onclick="event.stopPropagation();deleteGH(\''+e.id+'\')" title="Hapus">✕</button>' +
      '</div>';
  });
  html+='</div>';
  container.innerHTML=html;
}

// ── OPEN MODAL ────────────────────────────────────────────────
function openGHModal(id) {
  var entry=getGH().find(function(e){ return e.id===id; });
  if(!entry) return;

  var t=new Date(entry.timestamp).toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'});
  var content='';

  // Use stored HTML if available (identical to when it was solved)
  if(entry._html){
    content=entry._html;
  } else {
    // Rebuild from stored state if HTML somehow missing
    var s=entry._state;
    if(s){ content=buildResultHtml(s.isMax,s.c1,s.c2,s.cons,s.corners,s.evaluated,s.optPt); }
    else { content='<p style="color:var(--muted);padding:20px;">Detail tidak tersedia — data lama mungkin tidak menyimpan penyelesaian lengkap.</p>'; }
  }

  var modal='<div class="modal-overlay" id="ghModal" onclick="if(event.target===this)closeGHModal()">' +
    '<div class="modal-box">' +
      '<div class="modal-head">' +
        '<div>' +
          '<div class="modal-head-title">📈 '+entry.method+' — '+entry.type+'</div>' +
          '<div class="modal-head-meta">'+t+(entry.objective?' · Z = '+entry.objective:'')+'</div>' +
        '</div>' +
        '<button class="modal-close" onclick="closeGHModal()">✕</button>' +
      '</div>' +
      '<div class="modal-body" id="ghModalBody">' + content + '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn-md btn-md-dl" onclick="downloadGHSingle(\''+id+'\')">⬇ Unduh Entri Ini</button>' +
        '<button class="btn-md btn-md-del" onclick="deleteGH(\''+id+'\');closeGHModal()">Hapus</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', modal);
  document.body.style.overflow='hidden';

  // Redraw canvases inside modal after DOM settles
  setTimeout(function(){
    var s = entry._state;
    if(!s) return;
    // canvases in the modal body get new IDs to avoid conflicts
    var body = document.getElementById('ghModalBody');
    if(!body) return;
    var cv1 = body.querySelector('#chartX1');
    var cv2 = body.querySelector('#chartX2');
    var cvM = body.querySelector('#chartMain');
    if(cv1){ cv1.id='m_chartX1'; drawX1Chart('m_chartX1', s.cons, s.optPt); }
    if(cv2){ cv2.id='m_chartX2'; drawX2Chart('m_chartX2', s.cons, s.optPt); }
    if(cvM){ cvM.id='m_chartMain'; drawMainChart('m_chartMain', s.cons, s.corners, s.evaluated, s.optPt, s.c1, s.c2, s.isMax); }
    // Rebuild legend inside modal
    var leg = body.querySelector('#chartLegend');
    if(leg && s.cons){
      var lh='';
      s.cons.forEach(function(c,j){
        lh+='<div class="legend-item"><span class="legend-swatch" style="background:'+GCOLORS[j%GCOLORS.length]+';"></span>C'+(j+1)+': '+fN(c.a)+'x₁+'+fN(c.b)+'x₂ '+signStr(c.sign)+' '+fN(c.rhs)+'</div>';
      });
      lh+='<div class="legend-item"><span class="legend-dot-sm" style="background:#4ade80;"></span>Z* = '+fN(s.optPt.z)+'</div>';
      lh+='<div class="legend-item"><span class="legend-swatch" style="background:rgba(201,168,76,0.4);height:10px;"></span>Daerah Fisibel</div>';
      leg.innerHTML=lh;
    }
  }, 120);
}

function closeGHModal() {
  var m=document.getElementById('ghModal');
  if(m) m.remove();
  document.body.style.overflow='';
}

function downloadGHSingle(id) {
  var e=getGH().find(function(x){ return x.id===id; });
  if(!e) return;
  var txt='TRO — '+e.method+' ('+e.type+')\nWaktu: '+new Date(e.timestamp).toLocaleString('id-ID')+'\n';
  txt+='Z = '+e.objective+'\n';
  if(e.constraints) e.constraints.forEach(function(c){ txt+='  '+c+'\n'; });
  if(e.result){ txt+='x₁='+e.result.x1.toFixed(4)+', x₂='+e.result.x2.toFixed(4)+', Z='+e.result.z.toFixed(4)+'\n'; }
  var blob=new Blob([txt],{type:'text/plain'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download='TRO_Grafik_'+e.id+'.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ── TRANSFER TO SIMPLEX ───────────────────────────────────────
function xferToSimplex() {
  var c1=pf('g_c1'), c2=pf('g_c2');
  var cons=readCons();
  sessionStorage.setItem('tro_transfer', JSON.stringify({
    source:'grafik', target:'simplex',
    data:{ numVars:2, numConstraints:GS.numCons, objective:GS.objective,
      cOrig:[c1,c2], Aorig:cons.map(function(c){ return [c.a,c.b]; }),
      bOrig:cons.map(function(c){ return c.rhs; }), signs:cons.map(function(c){ return c.sign; }) }
  }));
  window.location.href='simplex.html';
}

// ── HELPERS ───────────────────────────────────────────────────
function wB(sn, title, content) {
  return '<div class="step-block"><div class="step-header">Langkah '+sn+' — '+title+'</div>'+content+'</div>';
}
function signStr(s){ return s==='le'?'≤':s==='ge'?'≥':'='; }
function intersect2(a1,b1,r1,a2,b2,r2){
  var det=a1*b2-a2*b1;
  if(Math.abs(det)<1e-10) return null;
  return [(r1*b2-r2*b1)/det,(a1*r2-a2*r1)/det];
}
function isSat(c,x1,x2){
  var lhs=c.a*x1+c.b*x2;
  if(c.sign==='le') return lhs<=c.rhs+1e-6;
  if(c.sign==='ge') return lhs>=c.rhs-1e-6;
  return Math.abs(lhs-c.rhs)<1e-6;
}
function r4(v){ return Math.round(v*10000)/10000; }
function pf(id){ return parseFloat(document.getElementById(id).value)||0; }
function fN(v){
  if(v===undefined||v===null||isNaN(v)) return '0';
  if(Math.abs(v)<1e-9) return '0';
  if(Number.isInteger(v)||Math.abs(v-Math.round(v))<1e-8) return String(Math.round(v));
  return String(parseFloat(v.toFixed(4)));
}
function niceStep(max,n){
  var r=max/n, e=Math.floor(Math.log10(r)), m=Math.pow(10,e), norm=r/m;
  if(norm<1.5) return m;
  if(norm<3.5) return 2*m;
  if(norm<7.5) return 5*m;
  return 10*m;
}

// ESC to close
document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeGHModal(); });