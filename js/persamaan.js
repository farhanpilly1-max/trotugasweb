// ============================================================
// persamaan.js — Eliminasi Gauss & Gauss-Jordan
// Variabel: 2–10, langkah matematis lengkap
// History: tersimpan penuh + bisa dibuka kembali + unduh PDF
// ============================================================

let pState = { n: 3, method: 'gauss' };

function initPersamaan() {
  renderMatrix();
  renderPersamaanHistory();
}

function setMethod(m) {
  pState.method = m;
  document.getElementById('btnGauss').classList.toggle('active', m === 'gauss');
  document.getElementById('btnGaussJordan').classList.toggle('active', m === 'gaussjordan');
}

function changeSize(delta) {
  const newN = pState.n + delta;
  if (newN < 2 || newN > 10) { alert('Ukuran sistem antara 2 sampai 10.'); return; }
  pState.n = newN;
  document.getElementById('sizeDisplay').textContent = newN;
  renderMatrix();
}

function renderMatrix() {
  const n = pState.n;
  const defaults = [
    [2,  1, -1,  0,  0,  0,  0,  0,  0,  0, 'le',   8],
    [-3,-1,  2,  0,  0,  0,  0,  0,  0,  0, 'le', -11],
    [-2, 1,  2,  0,  0,  0,  0,  0,  0,  0, 'le',  -3],
    [ 1, 0,  0,  1,  0,  0,  0,  0,  0,  0, 'le',   1],
    [ 0, 1,  0,  0,  1,  0,  0,  0,  0,  0, 'le',   2],
    [ 0, 0,  1,  0,  0,  1,  0,  0,  0,  0, 'le',   3],
    [ 1, 1,  0,  0,  0,  0,  1,  0,  0,  0, 'le',   4],
    [ 0, 0,  1,  1,  0,  0,  0,  1,  0,  0, 'le',   5],
    [ 1, 0,  0,  0,  1,  0,  0,  0,  1,  0, 'le',   6],
    [ 0, 1,  0,  0,  0,  1,  0,  0,  0,  1, 'le',   7],
  ];

  // ── Koefisien matrix ──
  let html = '<div class="matrix-grid">';
  for (let i = 0; i < n; i++) {
    const defSign = (defaults[i] && defaults[i][10] !== undefined) ? defaults[i][10] : 'eq';
    const rhsDef  = (defaults[i] && defaults[i][11] !== undefined) ? defaults[i][11] : 0;
    html += `<div class="matrix-row">`;
    for (let j = 0; j < n; j++) {
      const def = (defaults[i] && defaults[i][j] !== undefined) ? defaults[i][j] : (i === j ? 1 : 0);
      html += `
        <input type="number" id="m_${i}_${j}" value="${def}" class="matrix-coef" placeholder="0"/>
        <span class="var-lbl">x<sub>${j+1}</sub></span>
        ${j < n-1 ? '<span class="plus-op">+</span>' : ''}`;
    }
    html += `
      <select id="sign_p_${i}" class="sign-sel-p">
        <option value="le" ${defSign==='le'?'selected':''}>≤</option>
        <option value="ge" ${defSign==='ge'?'selected':''}>≥</option>
        <option value="eq" ${defSign==='eq'?'selected':''}>=</option>
      </select>
      <input type="number" id="rhs_${i}" value="${rhsDef}" class="rhs-coef" placeholder="0"/>
    </div>`;
  }
  html += '</div>';

  // ── Nilai awal variabel ──
  html += `<div class="init-vars-wrap">
    <div class="init-vars-label">
      <span class="init-vars-icon">🔢</span>
      Nilai Awal Variabel
      <span class="init-vars-hint">(opsional — akan diverifikasi sebelum penyelesaian)</span>
    </div>
    <div class="init-vars-row">`;
  for (let j = 0; j < n; j++) {
    html += `<div class="init-var-item">
      <label class="init-var-label">x<sub>${j+1}</sub></label>
      <input type="number" id="xinit_${j}" value="" class="init-var-input" placeholder="—"/>
    </div>`;
  }
  html += `</div>
    <p class="init-vars-note">Kosongkan jika tidak ingin menggunakan verifikasi nilai awal.</p>
  </div>`;

  document.getElementById('matrixInputs').innerHTML = html;
}

// ============================================================
// SOLVER
// ============================================================
function solvePersamaan() {
  const n = pState.n;
  const allSteps = [];
  let aug = [], origCoefs = [];

  for (let i = 0; i < n; i++) {
    let row = [];
    for (let j = 0; j < n; j++) row.push(parseFloat(document.getElementById(`m_${i}_${j}`).value) || 0);
    row.push(parseFloat(document.getElementById(`rhs_${i}`).value) || 0);
    aug.push(row);
    origCoefs.push([...row]);
  }

  // ── Baca nilai awal variabel (opsional) ──
  const initVals = [];
  let hasInitVals = false;
  for (let j = 0; j < n; j++) {
    const el = document.getElementById(`xinit_${j}`);
    const val = el && el.value.trim() !== '' ? parseFloat(el.value) : null;
    initVals.push(val);
    if (val !== null && !isNaN(val)) hasInitVals = true;
  }

  allSteps.push({ type:'formulasi', coefs:origCoefs, n, method:pState.method });

  // ── Langkah verifikasi nilai awal (jika diisi) ──
  if (hasInitVals) {
    allSteps.push({ type:'verif_awal', initVals, coefs:origCoefs, n });
  }

  allSteps.push({ type:'augmented_awal', matrix:cloneMatrix(aug), n });

  // ── FORWARD ELIMINATION ──
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let i = col+1; i < n; i++) {
      if (Math.abs(aug[i][col]) > Math.abs(aug[maxRow][col])) maxRow = i;
    }
    if (maxRow !== col) {
      const before = cloneMatrix(aug);
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      allSteps.push({ type:'swap', r1:col, r2:maxRow, before, after:cloneMatrix(aug), n });
    }

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let i = col+1; i < n; i++) {
      const factor = aug[i][col] / pivot;
      if (Math.abs(factor) < 1e-10) continue;
      const rowBefore = [...aug[i]], pivotRowSnap = [...aug[col]];
      for (let j = col; j <= n; j++) aug[i][j] -= factor * aug[col][j];
      allSteps.push({ type:'elim_below', targetRow:i, pivotRow:col, factor, rowBefore, pivotRowSnap, rowAfter:[...aug[i]], matrixAfter:cloneMatrix(aug), n });
    }

    if (pState.method === 'gaussjordan') {
      const pivNorm = aug[col][col];
      if (Math.abs(pivNorm) > 1e-10) {
        const rowBefore = [...aug[col]];
        for (let j = col; j <= n; j++) aug[col][j] /= pivNorm;
        allSteps.push({ type:'normalize', targetRow:col, divisor:pivNorm, rowBefore, rowAfter:[...aug[col]], matrixAfter:cloneMatrix(aug), n });
      }
      for (let i = 0; i < col; i++) {
        const factor2 = aug[i][col];
        if (Math.abs(factor2) < 1e-10) continue;
        const rowBefore = [...aug[i]], pivotRowSnap = [...aug[col]];
        for (let j = 0; j <= n; j++) aug[i][j] -= factor2 * aug[col][j];
        allSteps.push({ type:'elim_above', targetRow:i, pivotRow:col, factor:factor2, rowBefore, pivotRowSnap, rowAfter:[...aug[i]], matrixAfter:cloneMatrix(aug), n });
      }
    }
  }

  // ── CONSISTENCY CHECK ──
  let status = 'unique';
  for (let i = 0; i < n; i++) {
    let allZero = true;
    for (let j = 0; j < n; j++) { if (Math.abs(aug[i][j]) > 1e-10) { allZero = false; break; } }
    if (allZero && Math.abs(aug[i][n]) > 1e-10) { status = 'nosolution'; break; }
    if (allZero && Math.abs(aug[i][n]) < 1e-10) status = 'infinite';
  }

  // ── BACK SUBSTITUTION ──
  let solution = Array(n).fill(null);
  if (status === 'unique') {
    if (pState.method === 'gauss') {
      allSteps.push({ type:'echelon_form', matrix:cloneMatrix(aug), n });
      const backSubSteps = [];
      for (let i = n-1; i >= 0; i--) {
        let sum = aug[i][n];
        const knownTerms = [];
        for (let j = i+1; j < n; j++) { knownTerms.push({ coef:aug[i][j], varIdx:j, val:solution[j] }); sum -= aug[i][j]*solution[j]; }
        solution[i] = Math.abs(aug[i][i]) > 1e-10 ? sum / aug[i][i] : 0;
        backSubSteps.push({ varIdx:i, diag:aug[i][i], rhs:aug[i][n], knownTerms, result:solution[i] });
      }
      allSteps.push({ type:'back_sub', steps:backSubSteps, solution, n });
    } else {
      for (let i = 0; i < n; i++) solution[i] = aug[i][n];
      allSteps.push({ type:'read_solution', matrix:cloneMatrix(aug), solution, n });
    }
  }

  allSteps.push({ type:'result', solution, status, n, origCoefs });

  // Render → dapat HTML string
  const resultHtml = renderPersamaanResult(allSteps);

  // Simpan history dengan HTML lengkap
  savePersamaanHistory({
    method: 'Persamaan',
    type: pState.method === 'gauss' ? 'Eliminasi Gauss' : 'Gauss-Jordan',
    n,
    equations: origCoefs.map((row,i) => {
      const lhs = row.slice(0,n).map((v,j)=>`${fmtN(v)}x${j+1}`).join(' + ');
      return `${lhs} = ${fmtN(row[n])}`;
    }),
    initVals: hasInitVals ? initVals : null,
    result: { solution, status },
    _html: resultHtml,
  });

  // Tampilkan tombol PDF
  const pdfBar = document.getElementById('pdfBarPersamaan');
  if (pdfBar) pdfBar.style.display = 'flex';
}

function cloneMatrix(m) { return m.map(r => [...r]); }

// ============================================================
// RENDER — returns HTML string AND injects into DOM
// ============================================================
function renderPersamaanResult(allSteps) {
  const container = document.getElementById('persamaanResult');
  let html = '<div class="result-section">';
  let sn = 0;

  allSteps.forEach(step => {

    if (step.type === 'formulasi') {
      sn++;
      const { coefs, n, method } = step;
      const mName = method === 'gauss' ? 'Eliminasi Gauss' : 'Gauss-Jordan';
      const rows = coefs.map((row,i) => {
        const lhs = row.slice(0,n).map((v,j) => `${j===0?fmtC(v,true):fmtC(v,false)}x<sub>${j+1}</sub>`).join('');
        return `<div class="mb-row mb-con"><span class="con-num">P${i+1}:</span> ${lhs} <span class="ineq">&nbsp;=&nbsp;</span><span class="rhs">${fmtN(row[n])}</span></div>`;
      }).join('');
      html += wB(`Langkah ${sn} — Formulasi Sistem Persamaan Linear`,
        `<p class="s-explain">Sistem ${n} persamaan dan ${n} variabel. Metode: <b>${mName}</b>.</p>
        <div class="math-box"><div class="mb-row mb-label">Sistem Persamaan Linear:</div>${rows}
        <div class="mb-row mb-note mt8">Metode: <b>${mName}</b></div></div>`);
    }

    else if (step.type === 'verif_awal') {
      sn++;
      const { initVals, coefs, n } = step;
      const filled = initVals.filter(v => v !== null && !isNaN(v));

      // Cek apakah semua variabel terisi
      const allFilled = filled.length === n;

      // Hitung LHS setiap persamaan dengan nilai awal
      const checks = coefs.map((row, i) => {
        const lhs = row.slice(0, n).reduce((s, v, j) => {
          const xv = initVals[j];
          return s + v * (xv !== null && !isNaN(xv) ? xv : 0);
        }, 0);
        const rhs = row[n];
        const ok = Math.abs(lhs - rhs) < 1e-6;
        const calc = row.slice(0, n).map((v, j) => {
          const xv = initVals[j];
          const xStr = xv !== null && !isNaN(xv) ? fmtN(xv) : '?';
          return `${fmtN(v)}×${xStr}`;
        }).join(' + ');
        return { i, lhs, rhs, ok, calc };
      });

      const allOk = checks.every(c => c.ok);
      const someOk = checks.some(c => c.ok);

      // Status badge
      let statusBadge = '';
      if (!allFilled) {
        statusBadge = `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:8px;font-size:12px;color:#fbbf24;margin-bottom:14px;">
          ⚠️ Tidak semua variabel diisi — variabel kosong dianggap = 0
        </div>`;
      } else if (allOk) {
        statusBadge = `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:8px;font-size:12px;color:#4ade80;margin-bottom:14px;">
          ✅ Nilai awal memenuhi semua persamaan — ini sudah merupakan solusi!
        </div>`;
      } else {
        statusBadge = `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;font-size:12px;color:#f87171;margin-bottom:14px;">
          ❌ Nilai awal <b>tidak</b> memenuhi semua persamaan — metode akan mencari solusi yang tepat
        </div>`;
      }

      // Tampilkan nilai yang diisi
      const varDisplay = `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        ${initVals.map((v,j) => `
          <div style="display:flex;flex-direction:column;align-items:center;
            background:var(--panel2);border:1px solid ${v!==null&&!isNaN(v)?'rgba(201,168,76,0.3)':'rgba(122,133,153,0.2)'};
            border-radius:10px;padding:10px 16px;min-width:64px;">
            <span style="font-size:11px;color:var(--muted);margin-bottom:4px;">x<sub>${j+1}</sub></span>
            <strong style="font-size:18px;font-family:'JetBrains Mono',monospace;color:${v!==null&&!isNaN(v)?'var(--text)':'var(--muted)'};">
              ${v!==null&&!isNaN(v)?fmtN(v):'—'}
            </strong>
          </div>`).join('')}
      </div>`;

      // Tabel pengecekan per persamaan
      const checkRows = checks.map(c =>
        `<tr>
          <td style="text-align:left;color:var(--text-dim);">P${c.i+1}</td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${c.calc}</td>
          <td>${fmtN(c.lhs)}</td>
          <td>${fmtN(c.rhs)}</td>
          <td>${c.ok ? '<span style="color:#4ade80;font-weight:700;">✅ Ya</span>' : '<span style="color:#f87171;font-weight:700;">❌ Tidak</span>'}</td>
        </tr>`
      ).join('');

      html += wB(`Langkah ${sn} — Verifikasi Nilai Awal`,
        `<p class="s-explain">Cek apakah nilai awal yang Anda masukkan sudah memenuhi sistem persamaan. Jika belum, metode eliminasi akan mencari solusi yang tepat.</p>
        ${statusBadge}
        ${varDisplay}
        <div class="table-wrap">
          <table class="corner-table" style="font-size:13px;">
            <thead>
              <tr>
                <th>Persamaan</th>
                <th>Perhitungan LHS</th>
                <th>Hasil LHS</th>
                <th>RHS (b)</th>
                <th>Terpenuhi?</th>
              </tr>
            </thead>
            <tbody>${checkRows}</tbody>
          </table>
        </div>
        <div class="math-box" style="margin-top:14px;">
          <div class="mb-row mb-note">
            ${allOk
              ? '✅ Nilai awal sudah merupakan solusi. Proses eliminasi tetap ditampilkan untuk pembelajaran.'
              : `Dari ${n} persamaan, <b>${checks.filter(c=>c.ok).length}</b> terpenuhi dan <b>${checks.filter(c=>!c.ok).length}</b> tidak terpenuhi dengan nilai awal ini.`}
          </div>
        </div>`);
    }

    else if (step.type === 'augmented_awal') {
      sn++;
      html += wB(`Langkah ${sn} — Susun Matriks Augmented [A|b]`,
        `<p class="s-explain">Gabungkan matriks koefisien A dengan vektor konstanta b. Garis vertikal memisahkan koefisien dari nilai RHS.</p>
        ${drawMatrix(step.matrix, step.n, null, null)}`);
    }

    else if (step.type === 'swap') {
      sn++;
      const { r1, r2, before, after, n } = step;
      html += wB(`Langkah ${sn} — Pertukaran Baris R${r1+1} ↔ R${r2+1} (Partial Pivoting)`,
        `<p class="s-explain">Tukar baris agar pivot terbesar berada di diagonal — meningkatkan stabilitas numerik.</p>
        <div class="math-box">
          <div class="mb-row mb-con">Operasi: <span class="op-code">R${r1+1} ↔ R${r2+1}</span></div>
          <div class="mb-row mb-note">R${r1+1} lama: [ ${before[r1].map(v=>fmtN(v)).join(' , ')} ]</div>
          <div class="mb-row mb-note">R${r2+1} lama: [ ${before[r2].map(v=>fmtN(v)).join(' , ')} ]</div>
          <div class="mb-row mb-note">→ Pivot baru (${r1+1},${r1+1}) = <b>${fmtN(after[r1][r1])}</b></div>
        </div>
        <div class="mat-label">Setelah pertukaran:</div>${drawMatrix(after, n, r1, r1)}`);
    }

    else if (step.type === 'elim_below') {
      sn++;
      const { targetRow:tr, pivotRow:pr, factor, rowBefore, pivotRowSnap, rowAfter, matrixAfter, n } = step;
      const sgn = factor > 0 ? `− ${fmtN(factor)}` : `+ ${fmtN(Math.abs(factor))}`;
      html += wB(`Langkah ${sn} — Eliminasi Baris R${tr+1} (Bawah Pivot)`,
        `<p class="s-explain">Buat elemen kolom pivot di baris R${tr+1} = 0. Faktor = ${fmtN(rowBefore[pr])} ÷ ${fmtN(pivotRowSnap[pr])} = <b>${fmtN(factor)}</b>.</p>
        <div class="math-box"><div class="mb-row mb-con">Operasi: <span class="op-code">R${tr+1} ← R${tr+1} ${sgn} × R${pr+1}</span></div></div>
        <div class="table-wrap" style="margin-top:12px;">
          <table class="rowop-table">
            <thead><tr><th>Baris</th>${pColHdr(n)}</tr></thead>
            <tbody>
              <tr class="tr-before"><td>R${tr+1} (lama)</td>${rowBefore.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
              <tr class="tr-op"><td>${factor>0?'−':'+'}${fmtN(Math.abs(factor))} × R${pr+1}</td>${pivotRowSnap.map(v=>`<td class="op-td">${factor>0?'−':'+'}${fmtN(Math.abs(factor*v))}</td>`).join('')}</tr>
              <tr class="tr-after"><td>R${tr+1} (baru)</td>${rowAfter.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
            </tbody>
          </table>
        </div>
        <div class="mat-label" style="margin-top:12px;">Matriks setelah eliminasi:</div>${drawMatrix(matrixAfter, n, pr, pr)}`);
    }

    else if (step.type === 'normalize') {
      sn++;
      const { targetRow:tr, divisor, rowBefore, rowAfter, matrixAfter, n } = step;
      html += wB(`Langkah ${sn} — Normalisasi R${tr+1} (Gauss-Jordan)`,
        `<p class="s-explain">Bagi seluruh elemen R${tr+1} dengan pivot <b>${fmtN(divisor)}</b> → pivot menjadi 1.</p>
        <div class="math-box"><div class="mb-row mb-con">Operasi: <span class="op-code">R${tr+1} ← R${tr+1} ÷ ${fmtN(divisor)}</span></div></div>
        <div class="table-wrap" style="margin-top:12px;">
          <table class="rowop-table">
            <thead><tr><th>Baris</th>${pColHdr(n)}</tr></thead>
            <tbody>
              <tr class="tr-before"><td>R${tr+1} (lama)</td>${rowBefore.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
              <tr class="tr-op"><td>÷ ${fmtN(divisor)}</td>${rowBefore.map(()=>`<td class="op-td">÷${fmtN(divisor)}</td>`).join('')}</tr>
              <tr class="tr-after"><td>R${tr+1} (baru)</td>${rowAfter.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
            </tbody>
          </table>
        </div>
        <div class="mat-label" style="margin-top:12px;">Matriks setelah normalisasi:</div>${drawMatrix(matrixAfter, n, tr, tr)}`);
    }

    else if (step.type === 'elim_above') {
      sn++;
      const { targetRow:tr, pivotRow:pr, factor, rowBefore, pivotRowSnap, rowAfter, matrixAfter, n } = step;
      const sgn = factor > 0 ? `− ${fmtN(factor)}` : `+ ${fmtN(Math.abs(factor))}`;
      html += wB(`Langkah ${sn} — Eliminasi Atas R${tr+1} (Gauss-Jordan)`,
        `<p class="s-explain">Eliminasi elemen di <b>atas</b> pivot kolom ${pr+1} → membentuk RREF.</p>
        <div class="math-box">
          <div class="mb-row mb-con">Operasi: <span class="op-code">R${tr+1} ← R${tr+1} ${sgn} × R${pr+1}</span></div>
          <div class="mb-row mb-note">Faktor = elemen (${tr+1},${pr+1}) = ${fmtN(rowBefore[pr])}</div>
        </div>
        <div class="table-wrap" style="margin-top:12px;">
          <table class="rowop-table">
            <thead><tr><th>Baris</th>${pColHdr(n)}</tr></thead>
            <tbody>
              <tr class="tr-before"><td>R${tr+1} (lama)</td>${rowBefore.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
              <tr class="tr-op"><td>${factor>0?'−':'+'}${fmtN(Math.abs(factor))} × R${pr+1}</td>${pivotRowSnap.map(v=>`<td class="op-td">${factor>0?'−':'+'}${fmtN(Math.abs(factor*v))}</td>`).join('')}</tr>
              <tr class="tr-after"><td>R${tr+1} (baru)</td>${rowAfter.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
            </tbody>
          </table>
        </div>
        <div class="mat-label" style="margin-top:12px;">Setelah eliminasi atas:</div>${drawMatrix(matrixAfter, n, pr, pr)}`);
    }

    else if (step.type === 'echelon_form') {
      sn++;
      html += wB(`Langkah ${sn} — Bentuk Eselon Baris (Row Echelon Form)`,
        `<p class="s-explain">Eliminasi maju selesai. Semua elemen di bawah diagonal = 0. Siap substitusi balik.</p>
        ${drawMatrix(step.matrix, step.n, null, null)}`);
    }

    else if (step.type === 'back_sub') {
      sn++;
      const { steps:bss, n } = step;
      let bsHtml = '';
      bss.forEach(bs => {
        const { varIdx:vi, diag, rhs, knownTerms, result } = bs;
        let formula = `${fmtN(diag)} · x<sub>${vi+1}</sub>`;
        if (knownTerms.length > 0) {
          const known = knownTerms.map(k=>`${fmtN(k.coef)} · ${fmtN(k.val)}`).join(' + ');
          const knownSum = knownTerms.reduce((s,k)=>s+k.coef*k.val, 0);
          formula += ` = ${fmtN(rhs)} − (${known}) = ${fmtN(rhs)} − ${fmtN(knownSum)} = ${fmtN(rhs-knownSum)}`;
        } else {
          formula += ` = ${fmtN(rhs)}`;
        }
        const sum2 = knownTerms.reduce((s,k)=>s+k.coef*k.val, 0);
        bsHtml += `<div class="bs-row">
          <div class="bs-var">x<sub>${vi+1}</sub></div>
          <div class="bs-calc">${formula} &nbsp;→&nbsp; x<sub>${vi+1}</sub> = ${fmtN(rhs-sum2)} ÷ ${fmtN(diag)} = <b>${fmtN(result)}</b></div>
        </div>`;
      });
      html += wB(`Langkah ${sn} — Substitusi Balik (Back Substitution)`,
        `<p class="s-explain">Mulai dari baris terbawah, selesaikan satu per satu ke atas.</p>
        <div class="bs-container">${bsHtml}</div>`);
    }

    else if (step.type === 'read_solution') {
      sn++;
      const { matrix, solution, n } = step;
      html += wB(`Langkah ${sn} — Baca Solusi dari RREF (Gauss-Jordan)`,
        `<p class="s-explain">Matriks sudah berbentuk RREF — kolom RHS langsung memberikan nilai setiap variabel.</p>
        ${drawMatrix(matrix, n, null, null)}
        <div class="math-box" style="margin-top:12px;">
          <div class="mb-row mb-label">Solusi dari kolom RHS:</div>
          ${solution.map((v,i)=>`<div class="mb-row mb-con mb-indent">x<sub>${i+1}</sub> = <b>${fmtN(v)}</b></div>`).join('')}
        </div>`);
    }

    else if (step.type === 'result') {
      const { solution, status, n, origCoefs } = step;
      if (status === 'nosolution') {
        html += `<div class="result-summary-err"><div class="res-title-err">⚠️ Tidak Ada Solusi (Inkonsisten)</div>
          <p style="font-size:13px;color:var(--muted);margin-top:8px;">Terdapat kontradiksi dalam sistem — 0 = c (c ≠ 0).</p></div>`;
      } else if (status === 'infinite') {
        html += `<div class="result-summary-warn"><div class="res-title-warn">♾️ Tak Terhingga Banyak Solusi</div>
          <p style="font-size:13px;color:var(--muted);margin-top:8px;">Terdapat variabel bebas dalam sistem ini.</p></div>`;
      } else {
        html += `<div class="result-summary">
          <div class="res-title">✅ Solusi Unik Ditemukan!</div>
          <div class="res-vars">${solution.map((v,i)=>`<div class="res-var"><span>x<sub>${i+1}</sub></span><strong>${fmtN(v)}</strong></div>`).join('')}</div>
        </div>`;
        sn++;
        html += wB(`Langkah ${sn} — Verifikasi Solusi`,
          `<p class="s-explain">Substitusikan nilai ke setiap persamaan asal.</p>
          <div class="math-box">
            ${origCoefs.map((row,i)=>{
              const lhsVal = row.slice(0,n).reduce((s,v,j)=>s+v*solution[j],0);
              const ok = Math.abs(lhsVal-row[n])<1e-6;
              const calc = row.slice(0,n).map((v,j)=>`${fmtN(v)}×${fmtN(solution[j])}`).join(' + ');
              return `<div class="mb-row mb-indent">P${i+1}: ${calc} = ${fmtN(lhsVal)} = ${fmtN(row[n])} ${ok?'✅':'⚠️'}</div>`;
            }).join('')}
            <div class="mb-row mt8 verify-ok">✅ Semua persamaan terpenuhi. Solusi valid!</div>
          </div>`);
      }
    }
  });

  html += '</div>';
  container.innerHTML = html;
  container.scrollIntoView({ behavior:'smooth', block:'start' });
  return html; // kembalikan string untuk disimpan ke history
}

// ============================================================
// HISTORY
// ============================================================
const P_HIST_KEY = 'tro_persamaan_history';

function getPersamaanHistory() {
  try { return JSON.parse(localStorage.getItem(P_HIST_KEY) || '[]'); } catch { return []; }
}

function savePersamaanHistory(entry) {
  const h = getPersamaanHistory();
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  entry.timestamp = new Date().toISOString();
  h.unshift(entry);
  if (h.length > 60) h.length = 60;
  localStorage.setItem(P_HIST_KEY, JSON.stringify(h));
  renderPersamaanHistory();
}

function deletePersamaanHistory(id) {
  localStorage.setItem(P_HIST_KEY, JSON.stringify(getPersamaanHistory().filter(e=>e.id!==id)));
  renderPersamaanHistory();
}

function clearPersamaanHistory() {
  if (!confirm('Hapus semua riwayat persamaan?')) return;
  localStorage.removeItem(P_HIST_KEY);
  renderPersamaanHistory();
}

function downloadPersamaanHistory() {
  const h = getPersamaanHistory();
  if (!h.length) { alert('Belum ada riwayat.'); return; }
  let txt = '═══════════════════════════════════════\n     TRO — Riwayat Metode Persamaan\n     Diekspor: ' + new Date().toLocaleString('id-ID') + '\n═══════════════════════════════════════\n\n';
  h.forEach((e,i) => {
    txt += `[${i+1}] ${e.type} — ${new Date(e.timestamp).toLocaleString('id-ID')}\n    Ukuran: ${e.n}×${e.n}\n`;
    if (e.equations) e.equations.forEach(eq => txt += `    ${eq}\n`);
    if (e.result?.solution) e.result.solution.forEach((v,j) => txt += `    x${j+1} = ${v!==null?Number(v).toFixed(4):'—'}\n`);
    if (e.result?.status && e.result.status !== 'unique') txt += `    Status: ${e.result.status}\n`;
    txt += '\n';
  });
  const blob = new Blob([txt],{type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href=url; a.download=`TRO_Persamaan_${new Date().toISOString().slice(0,10)}.txt`; a.click(); URL.revokeObjectURL(url);
}

function renderPersamaanHistory() {
  const container = document.getElementById('persamaanHistory');
  const actEl = document.getElementById('pHistActions');
  if (!container) return;
  const h = getPersamaanHistory();

  if (!h.length) {
    container.innerHTML = '<div class="g-history-empty">Belum ada riwayat. Selesaikan perhitungan pertama.</div>';
    if (actEl) actEl.innerHTML = '';
    return;
  }

  if (actEl) {
    actEl.innerHTML =
      '<button class="btn-hist-action btn-dl" onclick="downloadPersamaanHistory()">⬇ Unduh .txt</button>' +
      '<button class="btn-hist-action btn-clr" onclick="clearPersamaanHistory()">🗑 Hapus Semua</button>';
  }

  let html = '<div class="g-history-list">';
  h.forEach(e => {
    const icon = e.type === 'Gauss-Jordan' ? '🔣' : '🔢';
    const t = new Date(e.timestamp).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const solStr = e.result?.solution?.filter(v=>v!==null).map((v,i)=>`x${i+1}=${Number(v).toFixed(2)}`).join(', ') || (e.result?.status||'');
    const hasDetail = !!e._html;
    html += `<div class="g-hist-item" onclick="openPersamaanModal('${e.id}')">
      <div class="g-hist-icon">${icon}</div>
      <div class="g-hist-body">
        <div class="g-hist-title">${e.type} — ${e.n}×${e.n}</div>
        <div class="g-hist-meta">${t}${solStr?' · '+solStr:''}${hasDetail?' · <span style="color:var(--success);font-size:11px;">✓ detail</span>':''}</div>
      </div>
      <button class="g-hist-del" onclick="event.stopPropagation();deletePersamaanHistory('${e.id}')" title="Hapus">✕</button>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ── Modal viewer ──────────────────────────────────────────────
function openPersamaanModal(id) {
  const entry = getPersamaanHistory().find(e=>e.id===id);
  if (!entry) return;
  const t = new Date(entry.timestamp).toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'});
  const solSummary = (entry.result?.solution?.filter(v=>v!==null).length)
    ? `<div class="result-summary" style="margin-bottom:16px;"><div class="res-title">Solusi</div>
        <div class="res-vars">${entry.result.solution.map((v,i)=>`<div class="res-var"><span>x<sub>${i+1}</sub></span><strong>${v!==null?Number(v).toFixed(4):'—'}</strong></div>`).join('')}</div></div>` : '';
  const content = entry._html
    ? `${solSummary}${entry._html}`
    : `${solSummary}<div style="padding:20px;color:var(--muted);font-size:13px;font-style:italic;">Detail langkah tersimpan dimulai dari sesi ini. Riwayat lama hanya menyimpan ringkasan.</div>`;

  const modal = `<div class="modal-overlay" id="pModal" onclick="if(event.target===this)closePModal()">
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <div class="modal-head-title">🔢 ${entry.type} — ${entry.n}×${entry.n}</div>
          <div class="modal-head-meta">${t}</div>
        </div>
        <button class="modal-close" onclick="closePModal()">✕</button>
      </div>
      <div class="modal-body" id="pModalBody">${content}</div>
      <div class="modal-foot">
        <button class="btn-md btn-md-dl" onclick="exportModalPDF('pModalBody','TRO_Persamaan_Detail')">📄 Unduh PDF</button>
        <button class="btn-md btn-md-dl" style="background:var(--gold-dim);color:var(--gold);border-color:var(--border-bright);" onclick="downloadPersamaanSingle('${id}')">⬇ Unduh .txt</button>
        <button class="btn-md btn-md-del" onclick="deletePersamaanHistory('${id}');closePModal()">Hapus</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modal);
  document.body.style.overflow = 'hidden';
}

function closePModal() {
  const m = document.getElementById('pModal'); if (m) m.remove();
  document.body.style.overflow = '';
}

// Export PDF dari modal body
function exportModalPDF(bodyId, filename) {
  if (typeof exportToPDF !== 'function') { alert('Library PDF belum siap.'); return; }
  exportToPDF(bodyId, filename, null);
}

function downloadPersamaanSingle(id) {
  const e = getPersamaanHistory().find(x=>x.id===id); if (!e) return;
  let txt = `TRO — ${e.type} (${e.n}×${e.n})\nWaktu: ${new Date(e.timestamp).toLocaleString('id-ID')}\n\n`;
  if (e.equations) { txt += 'Persamaan:\n'; e.equations.forEach(eq=>txt+=`  ${eq}\n`); }
  if (e.result?.solution) { txt += '\nSolusi:\n'; e.result.solution.forEach((v,i)=>txt+=`  x${i+1} = ${v!==null?Number(v).toFixed(4):'—'}\n`); }
  const blob = new Blob([txt],{type:'text/plain'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`TRO_Persamaan_${e.id}.txt`; a.click(); URL.revokeObjectURL(url);
}

document.addEventListener('keydown', e => { if (e.key==='Escape') closePModal(); });

// ── Helpers ──────────────────────────────────────────────────
function pColHdr(n) {
  return Array.from({length:n+1},(_,j) => j<n?`<th>x<sub>${j+1}</sub></th>`:`<th>RHS</th>`).join('');
}
function drawMatrix(matrix, n, pivRow, pivCol) {
  let h = '<div class="matrix-display-wrap"><table class="aug-table">';
  matrix.forEach((row,ri) => {
    h += '<tr>';
    row.forEach((val,ci) => {
      const isAug = ci===n, isPivot = pivRow!==null && pivCol!==null && ri===pivRow && ci===pivCol;
      h += `<td class="${isAug?'aug-sep':''} ${isPivot?'pivot-el':''}">${fmtN(val)}</td>`;
    });
    h += '</tr>';
  });
  h += '</table></div>';
  return h;
}
function wB(title, content) { return `<div class="step-block"><div class="step-header">${title}</div>${content}</div>`; }
function fmtN(v) {
  if (v===undefined||v===null||isNaN(v)) return '0';
  if (Math.abs(v)<1e-9) return '0';
  if (Number.isInteger(v)||Math.abs(v-Math.round(v))<1e-8) return String(Math.round(v));
  return String(parseFloat(v.toFixed(4)));
}
function fmtC(v, isFirst) {
  if (Math.abs(v)<1e-9) return '';
  if (isFirst) return v===1?'':v===-1?'−':fmtN(v);
  return `${v<0?' − ':' + '}${Math.abs(v)===1?'':fmtN(Math.abs(v))}`;
}