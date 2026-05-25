// ============================================================
// Simplex.js — Metode Simplex dengan Langkah Matematis Lengkap
// Setiap iterasi: analisis baris Z, uji rasio, operasi baris numerik penuh
// ============================================================

let simplexState = { numVars: 2, numConstraints: 2, objective: 'max' };

function initSimplex() { renderForm(); }

function renderForm() {
  const n = simplexState.numVars, m = simplexState.numConstraints;
  const vcEl = document.getElementById('varCount'), ccEl = document.getElementById('conCount');
  if (vcEl) vcEl.textContent = n;
  if (ccEl) ccEl.textContent = m;

  let objHtml = '<div class="eq-row">';
  for (let i = 0; i < n; i++) {
    objHtml += `<div class="eq-term">
      <input type="number" id="obj_${i}" placeholder="0" value="1" class="coef-input"/>
      <span class="var-label">x<sub>${i+1}</sub></span>
      ${i < n-1 ? '<span class="op">+</span>' : ''}
    </div>`;
  }
  objHtml += '</div>';
  document.getElementById('objInputs').innerHTML = objHtml;

  // ✅ PERBAIKAN: def dan value="${i<2?def:0}" dipindah ke dalam loop i
  let consHtml = '';
  for (let j = 0; j < m; j++) {
    consHtml += `<div class="constraint-row">`;
    for (let i = 0; i < n; i++) {
      const def = j===0 ? (i===0 ? 2 : 1) : (i===0 ? 1 : 2);
      consHtml += `<div class="eq-term">
        <input type="number" id="con_${j}_${i}" placeholder="0" value="${i < 2 ? def : 0}" class="coef-input"/>
        <span class="var-label">x<sub>${i+1}</sub></span>
        ${i < n-1 ? '<span class="op">+</span>' : ''}
      </div>`;
    }
    consHtml += `<select id="sign_${j}" class="sign-sel">
      <option value="le">≤</option><option value="ge">≥</option><option value="eq">=</option>
    </select>
    <input type="number" id="rhs_${j}" placeholder="0" value="${j===0?4:6}" class="coef-input rhs-input"/>
    </div>`;
  }
  document.getElementById('consInputs').innerHTML = consHtml;
}

function setObjective(type) {
  simplexState.objective = type;
  document.getElementById('btnMax').classList.toggle('active', type==='max');
  document.getElementById('btnMin').classList.toggle('active', type==='min');
}
function addVariable()    { if (simplexState.numVars>=10) {alert('Maksimal 10 variabel.'); return;} simplexState.numVars++; renderForm(); }
function removeVariable() { if (simplexState.numVars<=2)  {alert('Minimal 2 variabel.');  return;} simplexState.numVars--; renderForm(); }
function addConstraint()    { if (simplexState.numConstraints>=20) {alert('Maksimal 20 batasan.'); return;} simplexState.numConstraints++; renderForm(); }
function removeConstraint() { if (simplexState.numConstraints<=1)  {alert('Minimal 1 batasan.'); return;}  simplexState.numConstraints--; renderForm(); }

// ─────────────────────────────────────────────────────────────
// SOLVER
// ─────────────────────────────────────────────────────────────
function solveSimplex() {
  const n = simplexState.numVars, m = simplexState.numConstraints;
  const isMin = simplexState.objective === 'min';

  let cOrig = [];
  for (let i = 0; i < n; i++) cOrig.push(parseFloat(document.getElementById(`obj_${i}`).value)||0);
  let c = isMin ? cOrig.map(v => -v) : [...cOrig];

  let Aorig=[], bOrig=[], signs=[];
  for (let j = 0; j < m; j++) {
    let row=[];
    for (let i = 0; i < n; i++) row.push(parseFloat(document.getElementById(`con_${j}_${i}`).value)||0);
    Aorig.push(row); bOrig.push(parseFloat(document.getElementById(`rhs_${j}`).value)||0);
    signs.push(document.getElementById(`sign_${j}`).value);
  }

  // Column names
  let colNames = [];
  for (let i=0;i<n;i++) colNames.push(`x${i+1}`);
  for (let j=0;j<m;j++) colNames.push(`s${j+1}`);
  colNames.push('RHS');
  const TC = colNames.length;

  // Build tableau
  let tableau=[], basis=[];
  let b=[...bOrig];
  for (let j=0;j<m;j++) {
    let row=[...Aorig[j]];
    for (let k=0;k<m;k++) row.push(k===j?(signs[j]==='ge'?-1:1):0);
    if (signs[j]==='ge') { row=row.map(v=>-v); b[j]=-b[j]; }
    row.push(b[j]);
    tableau.push(row); basis.push(n+j);
  }
  let objRow=c.map(v=>-v); for (let j=0;j<m;j++) objRow.push(0); objRow.push(0);
  tableau.push(objRow);

  const allSteps=[];
  allSteps.push({ type:'formulasi', cOrig, Aorig, bOrig, signs, n, m, isMin });
  allSteps.push({ type:'standar',   cOrig, c, Aorig, bOrig, signs, n, m, isMin });
  allSteps.push({ type:'tableau_awal', tableau:cloneT(tableau), basis:[...basis], colNames });

  let iter=0; const MAX=50;
  while (iter<MAX) {
    iter++;
    const objR=tableau[tableau.length-1];
    let pivCol=-1, minVal=-1e-9;
    for (let j=0;j<objR.length-1;j++) if (objR[j]<minVal){minVal=objR[j]; pivCol=j;}
    if (pivCol===-1) break;

    let pivRow=-1, minRatio=Infinity, ratioData=[];
    for (let i=0;i<tableau.length-1;i++) {
      const el=tableau[i][pivCol], rhs=tableau[i][TC-1];
      if (el>1e-9) {
        const ratio=rhs/el;
        ratioData.push({i, basisName:colNames[basis[i]], el, rhs, ratio});
        if (ratio<minRatio){minRatio=ratio; pivRow=i;}
      } else {
        ratioData.push({i, basisName:colNames[basis[i]], el, rhs, ratio:null});
      }
    }
    if (pivRow===-1) { allSteps.push({type:'unbounded'}); break; }

    const pivEl=tableau[pivRow][pivCol];
    const enteringVar=colNames[pivCol], leavingVar=colNames[basis[pivRow]];
    const tableauBefore=cloneT(tableau), basisBefore=[...basis];

    // Compute row ops with actual numbers
    const oldPivRowVals=[...tableau[pivRow]];
    const newPivRowVals=oldPivRowVals.map(v=>v/pivEl);

    // Elimination ops — record before/factor/after
    const elimOps=[];
    tableau[pivRow]=newPivRowVals; basis[pivRow]=pivCol;
    for (let i=0;i<tableau.length;i++) {
      if (i===pivRow) continue;
      const factor=tableau[i][pivCol];
      if (Math.abs(factor)<1e-12) continue;
      const oldRow=[...tableau[i]];
      const newRow=oldRow.map((v,k)=>v-factor*newPivRowVals[k]);
      const rowLabel=i===tableau.length-1?'Z':`R${i+1}`;
      elimOps.push({i, rowLabel, factor, before:oldRow, pivRowNew:newPivRowVals, after:newRow});
      tableau[i]=newRow;
    }

    allSteps.push({
      type:'iterasi', iter, enteringVar, leavingVar, pivCol, pivRow, pivEl, minVal,
      ratioData, minRatio, tableauBefore, basisBefore,
      oldPivRowVals, newPivRowVals, elimOps,
      tableauAfter:cloneT(tableau), basisAfter:[...basis], colNames,
    });
  }

  const sol=extractSol(tableau, basis, n, isMin);
  allSteps.push({ type:'optimal', tableau:cloneT(tableau), basis:[...basis], colNames, sol, isMin, cOrig, Aorig, bOrig, signs, n, m, iter });

  // Simpan entry dulu, fullHtml diisi setelah render
  window._pendingSimplexEntry = {
    method:'Simplex', type:isMin?'Minimasi':'Maksimasi',
    objective:cOrig.map((v,i)=>`${v}x${i+1}`).join(' + '),
    constraints:Aorig.map((row,j)=>{
      const lhs=row.map((v,i)=>`${v}x${i+1}`).join('+');
      const s=signs[j]==='le'?'≤':signs[j]==='ge'?'≥':'=';
      return `${lhs} ${s} ${bOrig[j]}`;
    }),
    result:{variables:sol.variables, z:sol.z}
  };

  renderAllSteps(allSteps);
}

// ─────────────────────────────────────────────────────────────
// RENDER ENGINE
// ─────────────────────────────────────────────────────────────
function renderAllSteps(steps) {
  const container = document.getElementById('simplexResult');
  let html = '<div class="result-section">';
  let sn = 0;

  steps.forEach(step => {
    if (step.type === 'formulasi') {
      sn++;
      const {cOrig,Aorig,bOrig,signs,n,m,isMin} = step;
      html += wrapBlock(`Langkah ${sn} — Formulasi Model Program Linier`, `
        <p class="s-explain">Nyatakan masalah optimasi dalam bentuk matematika yang jelas, meliputi fungsi tujuan dan semua batasan.</p>
        <div class="math-box">
          <div class="mb-row mb-goal">
            ${isMin?'Min':'Maks'} Z = ${cOrig.map((v,i)=>`${fmtCoef(v,i===0)}x<sub>${i+1}</sub>`).join('')}
          </div>
          <div class="mb-row mb-label">Batasan (Subject to):</div>
          ${Aorig.map((row,j)=>`
            <div class="mb-row mb-con">
              <span class="con-num">C${j+1}:</span>
              ${row.map((v,i)=>`${fmtCoef(v,i===0)}x<sub>${i+1}</sub>`).join('')}
              <span class="ineq">&nbsp;${signs[j]==='le'?'≤':signs[j]==='ge'?'≥':'='}&nbsp;</span>
              <span class="rhs">${bOrig[j]}</span>
            </div>`).join('')}
          <div class="mb-row mb-noneg">x<sub>i</sub> ≥ 0 &nbsp;&nbsp; (i = 1, 2, ..., ${n})</div>
        </div>
      `);
    }

    else if (step.type === 'standar') {
      sn++;
      const {cOrig,c,Aorig,bOrig,signs,n,m,isMin} = step;
      let rows = '';
      if (isMin) {
        rows += `<div class="mb-row mb-note">⚠️ Tujuan adalah <b>minimasi</b>. Konversi ke maksimasi dengan membalik tanda koefisien fungsi tujuan:</div>`;
        rows += `<div class="mb-row mb-con mb-indent">
          Min Z = ${cOrig.map((v,i)=>`${fmtCoef(v,i===0)}x<sub>${i+1}</sub>`).join('')}
          <span style="color:var(--gold);">&nbsp;→&nbsp;</span>
          Maks Z' = ${c.map((v,i)=>`${fmtCoef(v,i===0)}x<sub>${i+1}</sub>`).join('')}
        </div>`;
      }
      rows += `<div class="mb-row mb-label mt12">Konversi batasan ke bentuk persamaan dengan variabel slack:</div>`;
      rows += `<div class="mb-row mb-note">• Batasan <b>≤</b>: tambahkan variabel slack positif (+s<sub>i</sub>), karena LHS + slack = RHS</div>`;
      rows += `<div class="mb-row mb-note">• Batasan <b>≥</b>: tambahkan variabel surplus negatif (−s<sub>i</sub>), karena LHS − surplus = RHS</div>`;
      rows += `<div class="mb-row mb-note">• Batasan <b>=</b>: tidak perlu penambahan variabel</div>`;
      Aorig.forEach((row,j) => {
        const lhs = row.map((v,i)=>`${fmtCoef(v,i===0)}x<sub>${i+1}</sub>`).join('');
        const slk = signs[j]==='le' ? `<span class="slk-add"> + s<sub>${j+1}</sub></span>`
                  : signs[j]==='ge' ? `<span class="slk-sub"> − s<sub>${j+1}</sub></span>`
                  : '';
        rows += `<div class="mb-row mb-con mt8">
          <span class="con-num">C${j+1}:</span> ${lhs}${slk}
          <span class="ineq">&nbsp;=&nbsp;</span><span class="rhs">${bOrig[j]}</span>
          <span class="con-note">&nbsp;&nbsp;(s<sub>${j+1}</sub> = variabel slack batasan ${j+1})</span>
        </div>`;
      });
      rows += `<div class="mb-row mb-label mt12">Fungsi tujuan dalam bentuk baris Z (Z − c·x = 0):</div>`;
      rows += `<div class="mb-row mb-con mb-indent">
        Z ${c.map((v,i)=>`${v<0?'+':'−'} ${fmtN(Math.abs(v))}x<sub>${i+1}</sub>`).join(' ')}
        ${Array.from({length:m},(_,j)=>`+ 0·s<sub>${j+1}</sub>`).join(' ')} = 0
      </div>`;
      rows += `<div class="mb-row mb-note mt8">Variabel basis awal: {${Array.from({length:m},(_,i)=>`s<sub>${i+1}</sub>`).join(', ')}}, dengan nilai = RHS masing-masing batasan.</div>`;
      html += wrapBlock(`Langkah ${sn} — Mengubah ke Bentuk Standar`, `
        <p class="s-explain">Metode Simplex memerlukan semua batasan dalam bentuk persamaan. Variabel slack ditambahkan agar setiap ketidaksamaan menjadi persamaan.</p>
        <div class="math-box">${rows}</div>
      `);
    }

    else if (step.type === 'tableau_awal') {
      sn++;
      html += wrapBlock(`Langkah ${sn} — Tabel Simplex Awal`, `
        <p class="s-explain">Masukkan semua koefisien ke dalam tabel simplex. Kolom <b>Basis</b> menunjukkan variabel yang sedang menjadi variabel dasar (bernilai tidak nol). Nilai RHS adalah nilai variabel basis tersebut.</p>
        ${drawTableau(step.tableau, step.basis, step.colNames, null, null)}
        <div class="tableau-note">
          <b>Kondisi optimalitas:</b> Solusi optimal tercapai jika semua koefisien di baris Z ≥ 0.<br>
          <b>Baris Z saat ini:</b> ${step.tableau[step.tableau.length-1].slice(0,-1).map((v,j)=>`${step.colNames[j]}=${fmtN(v)}`).join(', ')} | RHS=${fmtN(step.tableau[step.tableau.length-1][step.tableau[0].length-1])}
        </div>
        ${checkOpt(step.tableau, step.colNames)}
      `);
    }

    else if (step.type === 'iterasi') {
      sn++;
      const {iter,enteringVar,leavingVar,pivCol,pivRow,pivEl,minVal,ratioData,minRatio,
             tableauBefore,basisBefore,oldPivRowVals,newPivRowVals,elimOps,
             tableauAfter,basisAfter,colNames} = step;
      const zRowBefore = tableauBefore[tableauBefore.length-1];

      let content = `<p class="s-explain">Satu siklus simplex: tentukan variabel masuk (entering) → tentukan variabel keluar (leaving) → operasi baris.</p>`;

      // Sub A — pilih kolom pivot
      const negEntries = zRowBefore.slice(0,-1).map((v,j)=>({v,j})).filter(e=>e.v<-1e-9);
      content += subWrap('A', `Menentukan Kolom Pivot — Variabel Masuk (Entering Variable)`, `
        <p class="s-explain">Pilih kolom dengan koefisien <b>paling negatif</b> di baris Z. Koefisien negatif berarti menaikkan variabel tersebut akan meningkatkan nilai Z.</p>
        <div class="math-box">
          <div class="mb-row mb-label">Baris Z saat ini (koefisien variabel):</div>
          <div class="zrow-cells">
            ${zRowBefore.slice(0,-1).map((v,j)=>`
              <div class="zcell ${j===pivCol?'zcell-pivot':''}">
                <div class="zcell-var">${colNames[j]}</div>
                <div class="zcell-val">${fmtN(v)}</div>
              </div>`).join('')}
          </div>
          <div class="mb-row mt8">Koefisien negatif yang ditemukan:
            ${negEntries.map(e=>`<b>${colNames[e.j]} = ${fmtN(e.v)}</b>`).join(', ')}
          </div>
          <div class="mb-row">Nilai paling negatif: <b>${fmtN(minVal)}</b> pada kolom <span class="hvar">${enteringVar}</span></div>
          <div class="mb-row result-row">→ <b>Kolom pivot = kolom ${enteringVar}</b> (${enteringVar} akan masuk ke basis)</div>
        </div>
      `);

      // Sub B — uji rasio
      content += subWrap('B', `Uji Rasio Minimum — Variabel Keluar (Leaving Variable)`, `
        <p class="s-explain">Hitung Rasio = RHS ÷ elemen kolom pivot untuk baris dengan elemen positif. Rasio terkecil menentukan baris yang keluar (mencegah solusi negatif).</p>
        <div class="math-box">
          <div class="mb-row mb-label">Perhitungan rasio untuk kolom ${enteringVar}:</div>
          <table class="calc-table">
            <thead><tr><th>Baris</th><th>Variabel Basis</th><th>Nilai RHS</th><th>Koef. Kolom ${enteringVar}</th><th>Rasio = RHS ÷ Koef.</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${ratioData.map(r=>{
                const win = r.i===pivRow;
                return `<tr class="${win?'tr-win':''}">
                  <td>R${r.i+1}</td>
                  <td>${r.basisName}</td>
                  <td>${fmtN(r.rhs)}</td>
                  <td>${fmtN(r.el)}</td>
                  <td>${r.ratio!==null ? `${fmtN(r.rhs)} ÷ ${fmtN(r.el)} = <b>${fmtN(r.ratio)}</b>` : `${fmtN(r.el)} ≤ 0, tidak valid`}</td>
                  <td>${win?'<b class="min-tag">← Minimum ✓</b>':r.ratio===null?'Dilewati':''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class="mb-row mt12">Rasio minimum = <b>${fmtN(minRatio)}</b> → baris R${pivRow+1} (basis: <b>${leavingVar}</b>)</div>
          <div class="mb-row">Elemen pivot = <b>${fmtN(pivEl)}</b> &nbsp;(persilangan baris R${pivRow+1} × kolom ${enteringVar})</div>
          <div class="mb-row result-row">→ <b>${leavingVar}</b> keluar dari basis, <b>${enteringVar}</b> masuk ke basis</div>
        </div>
      `);

      // Sub C — tabel sebelum
      content += subWrap('C', `Tabel Sebelum Operasi Pivot`, `
        <p class="s-explain">Kondisi tabel saat ini. Elemen pivot disorot (kotak oranye). Baris pivot dan kolom pivot juga ditandai.</p>
        ${drawTableau(tableauBefore, basisBefore, colNames, pivRow, pivCol)}
        <div class="tableau-note">Elemen pivot = <b>${fmtN(pivEl)}</b> di posisi baris R${pivRow+1}, kolom ${enteringVar}</div>
      `);

      // Sub D — operasi baris PENUH dengan angka
      let opsHtml = `<p class="s-explain">Tujuan operasi baris: jadikan elemen pivot = 1, dan semua elemen lain di kolom pivot = 0. Ini dilakukan dengan operasi baris elementer.</p>
        <div class="math-box">`;

      // Step D1: normalisasi baris pivot
      opsHtml += `<div class="op-section">
        <div class="op-section-title">Langkah D1: Normalisasi Baris Pivot R${pivRow+1}</div>
        <div class="mb-row mb-note">Bagi semua elemen baris R${pivRow+1} dengan elemen pivot (${fmtN(pivEl)}) agar elemen pivot = 1</div>
        <div class="mb-row mb-con">Rumus: R${pivRow+1} baru ← R${pivRow+1} lama ÷ ${fmtN(pivEl)}</div>
        <table class="rowop-table">
          <thead><tr><th>Baris</th>${colNames.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
          <tbody>
            <tr class="tr-before"><td>R${pivRow+1} (lama)</td>${oldPivRowVals.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
            <tr class="tr-op"><td>÷ ${fmtN(pivEl)}</td>${oldPivRowVals.map(v=>`<td class="op-td">÷ ${fmtN(pivEl)}</td>`).join('')}</tr>
            <tr class="tr-after"><td>R${pivRow+1} (baru)</td>${newPivRowVals.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>`;

      // Steps D2+: eliminasi baris lain
      elimOps.forEach((op, idx) => {
        const sign = op.factor > 0 ? `− ${fmtN(op.factor)}` : `+ ${fmtN(Math.abs(op.factor))}`;
        const factorAbs = Math.abs(op.factor);
        opsHtml += `<div class="op-section">
          <div class="op-section-title">Langkah D${idx+2}: Eliminasi Baris ${op.rowLabel}</div>
          <div class="mb-row mb-note">
            Elemen kolom ${enteringVar} di baris ${op.rowLabel} = <b>${fmtN(op.factor)}</b>.
            Kurangi baris ini dengan <b>${fmtN(op.factor)} × R${pivRow+1} baru</b> agar elemen kolom pivot = 0.
          </div>
          <div class="mb-row mb-con">Rumus: ${op.rowLabel} baru ← ${op.rowLabel} lama ${sign} × R${pivRow+1} baru</div>
          <table class="rowop-table">
            <thead><tr><th>Baris</th>${colNames.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
            <tbody>
              <tr class="tr-before"><td>${op.rowLabel} (lama)</td>${op.before.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
              <tr class="tr-op">
                <td>${op.factor>0?'−':'+'}${fmtN(factorAbs)} × R${pivRow+1} baru</td>
                ${op.pivRowNew.map(v=>`<td class="op-td">${op.factor>0?'−':'+'}${fmtN(Math.abs(op.factor*v))}</td>`).join('')}
              </tr>
              <tr class="tr-after"><td>${op.rowLabel} (baru)</td>${op.after.map(v=>`<td>${fmtN(v)}</td>`).join('')}</tr>
            </tbody>
          </table>
        </div>`;
      });

      opsHtml += '</div>';
      content += subWrap('D', `Operasi Baris Elementer — Perhitungan Numerik Lengkap`, opsHtml);

      // Sub E — tabel setelah
      content += subWrap('E', `Tabel Simplex Setelah Iterasi ${iter}`, `
        <p class="s-explain">Tabel yang sudah diperbarui. Basis baru: <b>${enteringVar}</b> menggantikan <b>${leavingVar}</b>.</p>
        ${drawTableau(tableauAfter, basisAfter, colNames, null, null)}
        ${checkOpt(tableauAfter, colNames)}
      `);

      html += wrapBlock(`Langkah ${sn} — Iterasi ${iter}`, content);
    }

    else if (step.type === 'optimal') {
      const {tableau,basis,colNames,sol,isMin,cOrig,Aorig,bOrig,signs,n,m,iter} = step;

      // Summary card
      html += `<div class="result-summary">
        <div class="res-title">✅ Solusi Optimal Ditemukan!</div>
        <div class="res-vars">
          ${Array.from({length:n},(_,i)=>`<div class="res-var"><span>x<sub>${i+1}</sub></span><strong>${fmtN(sol.variables[i])}</strong></div>`).join('')}
        </div>
        <div class="res-z">Nilai ${isMin?'Minimum':'Maksimum'} Z = <strong>${sol.z.toFixed(4)}</strong></div>
        <div style="margin-top:10px;font-size:12px;color:var(--muted);">Diselesaikan dalam ${iter} iterasi &nbsp;·&nbsp; ${n} variabel &nbsp;·&nbsp; ${m} batasan</div>
      </div>`;

      // Read solution step
      sn++;
      html += wrapBlock(`Langkah ${sn} — Membaca Solusi dari Tabel Akhir`, `
        <p class="s-explain">Iterasi berhenti karena semua koefisien di baris Z ≥ 0. Solusi dibaca langsung dari tabel:</p>
        ${drawTableau(tableau, basis, colNames, null, null)}
        <div class="math-box mt16">
          <div class="mb-row mb-label">Cara membaca solusi:</div>
          <div class="mb-row mb-note">• Variabel yang ada di kolom <b>Basis</b> → nilainya = nilai RHS pada baris tersebut</div>
          <div class="mb-row mb-note">• Variabel yang <b>tidak</b> ada di kolom Basis → nilainya = 0</div>
          <div class="mb-row mb-label mt12">Variabel basis akhir: { ${basis.slice(0,m).map(b=>colNames[b]).join(', ')} }</div>
          ${basis.slice(0,m).map((b,i)=>`<div class="mb-row mb-con mb-indent">${colNames[b]} = ${fmtN(tableau[i][tableau[i].length-1])}</div>`).join('')}
          ${Array.from({length:n},(_,i)=>i).filter(i=>!basis.slice(0,m).includes(i))
            .map(i=>`<div class="mb-row mb-con mb-indent">${colNames[i]} = 0 &nbsp; (tidak ada di basis)</div>`).join('')}
          <div class="mb-row mb-con mt12 mb-goal">Z = ${cOrig.map((v,i)=>`${fmtN(v)} × ${fmtN(sol.variables[i])}`).join(' + ')} = <b>${fmtN(sol.z)}</b></div>
        </div>
      `);

      // Verification
      sn++;
      html += wrapBlock(`Langkah ${sn} — Verifikasi Solusi`, `
        <p class="s-explain">Substitusikan nilai variabel ke fungsi tujuan dan semua batasan untuk memastikan solusi valid.</p>
        <div class="math-box">
          <div class="mb-row mb-label">1. Substitusi ke Fungsi Tujuan:</div>
          <div class="mb-row mb-indent">
            Z = ${cOrig.map((v,i)=>`${fmtN(v)} × ${fmtN(sol.variables[i])}`).join(' + ')}
            = ${cOrig.map((v,i)=>`${fmtN(v*sol.variables[i])}`).join(' + ')}
            = <b>${fmtN(cOrig.reduce((s,v,i)=>s+v*sol.variables[i],0))}</b> ✅
          </div>
          <div class="mb-row mb-label mt12">2. Verifikasi semua batasan:</div>
          ${Aorig.map((row,j)=>{
            const lhsVal = row.reduce((s,v,i)=>s+v*sol.variables[i],0);
            const s = signs[j]==='le'?'≤':signs[j]==='ge'?'≥':'=';
            const ok = signs[j]==='le'?lhsVal<=bOrig[j]+1e-6:signs[j]==='ge'?lhsVal>=bOrig[j]-1e-6:Math.abs(lhsVal-bOrig[j])<1e-6;
            return `<div class="mb-row mb-indent">
              Batasan ${j+1}: ${row.map((v,i)=>`${fmtN(v)}×${fmtN(sol.variables[i])}`).join(' + ')}
              = ${fmtN(lhsVal)} ${s} ${bOrig[j]} ${ok?'✅':'⚠️'}
            </div>`;
          }).join('')}
          <div class="mb-row mt12 mb-goal verify-ok">
            ✅ Solusi valid! &nbsp; Nilai ${isMin?'minimum':'maksimum'} Z = <b>${sol.z.toFixed(4)}</b>
          </div>
        </div>
      `);
    }

    else if (step.type === 'unbounded') {
      html += `<div class="step-block"><div class="step-header">⚠️ Solusi Tidak Terbatas</div>
        <div class="no-sol">Semua nilai di kolom pivot ≤ 0, sehingga tidak ada batas atas untuk Z. Periksa kembali formulasi model Anda.</div>
      </div>`;
    }
  });

  html += '</div>';
  container.innerHTML = html;
  container.scrollIntoView({ behavior:'smooth', block:'start' });

  // Simpan ke history dengan HTML lengkap
  if (window._pendingSimplexEntry) {
    window._pendingSimplexEntry.fullHtml = html;
    saveToHistory(window._pendingSimplexEntry);
    window._pendingSimplexEntry = null;
  }
}

// ─────────────────────────────────────────────────────────────
// HTML HELPERS
// ─────────────────────────────────────────────────────────────
function wrapBlock(title, content) {
  return `<div class="step-block"><div class="step-header">${title}</div>${content}</div>`;
}
function subWrap(letter, title, content) {
  return `<div class="sub-block"><div class="sub-header"><span class="sub-badge">${letter}</span>${title}</div>${content}</div>`;
}
function drawTableau(tableau, basis, colNames, pivRow, pivCol) {
  let h = '<div class="table-wrap"><table class="simplex-table"><thead><tr><th>Basis</th>';
  colNames.forEach(c => h += `<th>${c}</th>`);
  h += '</tr></thead><tbody>';
  const nr = tableau.length;
  tableau.forEach((row, i) => {
    const isZ = i === nr-1;
    const bName = isZ ? 'Z' : (basis[i]!==undefined ? colNames[basis[i]] : '—');
    h += `<tr class="${isZ?'obj-row':''}"><td class="basis-cell">${bName}</td>`;
    row.forEach((val, j) => {
      const ip = pivRow!==null&&pivCol!==null&&pivRow===i&&pivCol===j;
      const ipc= pivRow!==null&&pivCol!==null&&pivCol===j&&!isZ;
      const ipr= pivRow!==null&&pivRow===i;
      h += `<td class="${ip?'pivot-cell':ipc?'piv-col':ipr?'piv-row':''}">${fmtN(val)}</td>`;
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}
function checkOpt(tableau, colNames) {
  const zRow = tableau[tableau.length-1];
  const neg = zRow.slice(0,-1).map((v,j)=>({v,j})).filter(e=>e.v<-1e-9);
  if (!neg.length) return `<div class="optimal-note">✅ Semua koefisien baris Z ≥ 0. <b>Solusi sudah optimal!</b></div>`;
  return `<div class="not-optimal-note">⚠️ Masih terdapat koefisien negatif: <b>${neg.map(e=>colNames[e.j]+'='+fmtN(e.v)).join(', ')}</b>. Lanjutkan ke iterasi berikutnya.</div>`;
}

// ─────────────────────────────────────────────────────────────
// NUMBER HELPERS
// ─────────────────────────────────────────────────────────────
function fmtN(v) {
  if (v===undefined||v===null||isNaN(v)) return '0';
  if (Math.abs(v)<1e-9) return '0';
  if (Number.isInteger(v)||Math.abs(v-Math.round(v))<1e-8) return String(Math.round(v));
  return String(parseFloat(v.toFixed(4)));
}
function fmtCoef(v, isFirst) {
  if (Math.abs(v) < 1e-9) return '';
  if (isFirst) return `${v === 1 ? '' : v === -1 ? '−' : fmtN(v)}`;
  const sign = v < 0 ? ' − ' : ' + ';
  const abs = Math.abs(v);
  return `${sign}${abs === 1 ? '' : fmtN(abs)}`;
}
function cloneT(t) { return t.map(r=>[...r]); }
function extractSol(tableau, basis, n, isMin) {
  const nc = tableau[0].length;
  const sol = Array(n).fill(0);
  for (let i=0;i<basis.length;i++) if (basis[i]<n) sol[basis[i]]=tableau[i][nc-1];
  const zVal = tableau[tableau.length-1][nc-1];
  return { variables:sol, z:isMin?-zVal:zVal };
}

// ─────────────────────────────────────────────────────────────
// HISTORY — tersimpan penuh, klik → modal, modal → unduh PDF
// ─────────────────────────────────────────────────────────────
const HISTORY_KEY = 'tro_simplex_history';

function saveToHistory(e) {
  try {
    const h = getSimplexHistory();
    if (!e.id) {
      e.id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
      e.timestamp = new Date().toISOString();
    }
    h.unshift(e);
    if (h.length > 60) h.length = 60;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    renderHistoryPanel();
  } catch(err) {}
}

function getSimplexHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function deleteHistoryItem(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getSimplexHistory().filter(e => e.id !== id)));
  renderHistoryPanel();
}

function clearAllHistory() {
  if (!confirm('Hapus semua riwayat simplex?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryPanel();
}

function downloadHistory() {
  const history = getSimplexHistory();
  if (!history.length) { alert('Belum ada riwayat.'); return; }
  let txt = '═══════════════════════════════════════\n     TRO — Riwayat Metode Simplex\n';
  txt += `     Diekspor: ${new Date().toLocaleString('id-ID')}\n═══════════════════════════════════════\n\n`;
  history.forEach((e, i) => {
    txt += `[${i+1}] ${e.type} — ${new Date(e.timestamp).toLocaleString('id-ID')}\n`;
    txt += `    Fungsi Tujuan: Z = ${e.objective}\n`;
    if (e.constraints) { txt += '    Batasan:\n'; e.constraints.forEach(c => txt += `      ${c}\n`); }
    if (e.result) {
      txt += '    Hasil:\n';
      if (e.result.variables) e.result.variables.forEach((v,j) => txt += `      x${j+1} = ${v.toFixed(4)}\n`);
      if (e.result.z !== undefined) txt += `      Z = ${e.result.z.toFixed(4)}\n`;
    }
    txt += '\n';
  });
  const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `TRO_Simplex_${new Date().toISOString().slice(0,10)}.txt`; a.click();
  URL.revokeObjectURL(url);
}

function downloadSingleHistory(id) {
  const e = getSimplexHistory().find(x => x.id === id); if (!e) return;
  let txt = `TRO — Simplex (${e.type})\nWaktu: ${new Date(e.timestamp).toLocaleString('id-ID')}\nFungsi Tujuan: Z = ${e.objective}\n`;
  if (e.constraints) { txt += 'Batasan:\n'; e.constraints.forEach(c => txt += `  ${c}\n`); }
  if (e.result?.variables) e.result.variables.forEach((v,j) => txt += `x${j+1} = ${v.toFixed(4)}\n`);
  if (e.result?.z !== undefined) txt += `Z = ${e.result.z.toFixed(4)}\n`;
  const blob = new Blob([txt], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `TRO_Simplex_${e.id}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ── MODAL: buka riwayat penuh ──
function openSimplexModal(id) {
  const entry = getSimplexHistory().find(e => e.id === id);
  if (!entry) return;

  const existing = document.getElementById('sxModal');
  if (existing) existing.remove();

  const t = new Date(entry.timestamp).toLocaleString('id-ID', {dateStyle:'long', timeStyle:'short'});
  const hasDetail = !!entry.fullHtml;

  const solSummary = entry.result ? `
    <div style="background:linear-gradient(135deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04));
      border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:24px 28px;margin-bottom:20px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.6),transparent);"></div>
      <div style="font-family:'Playfair Display',serif;font-size:16px;color:var(--gold);margin-bottom:14px;">◈ Solusi ${entry.type}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        ${(entry.result.variables||[]).map((v,i)=>`
          <div style="display:flex;flex-direction:column;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 18px;min-width:72px;">
            <span style="font-size:11px;color:var(--muted);margin-bottom:5px;">x<sub>${i+1}</sub></span>
            <strong style="font-size:20px;color:var(--text);">${v.toFixed(4)}</strong>
          </div>`).join('')}
      </div>
      <div style="font-size:15px;color:var(--text);">
        Nilai ${entry.type === 'Minimasi' ? 'Minimum' : 'Maksimum'} Z =
        <strong style="color:var(--gold);font-size:20px;">
          ${entry.result.z !== undefined ? entry.result.z.toFixed(4) : '—'}
        </strong>
      </div>
    </div>` : '';

  const detailContent = hasDetail
    ? entry.fullHtml
    : `<div style="padding:20px;background:var(--panel2);border-radius:12px;border:1px solid var(--border);
        font-size:13px;color:var(--muted);font-style:italic;text-align:center;line-height:1.8;">
        💡 Detail langkah penyelesaian tersimpan mulai sesi ini.<br>
        Riwayat lama hanya menyimpan ringkasan hasil.
      </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'sxModal';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(8,12,24,0.9);
    backdrop-filter: blur(12px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  `;
  overlay.onclick = function(e) { if (e.target === overlay) closeSxModal(); };

  overlay.innerHTML = `
    <div style="
      background: #0f1624;
      border: 1px solid rgba(201,168,76,0.4);
      border-radius: 20px;
      width: 100%; max-width: 900px;
      max-height: 88vh;
      display: flex; flex-direction: column;
      box-shadow: 0 40px 100px rgba(0,0,0,0.8);
      position: relative; overflow: hidden;
      font-family: 'DM Sans', sans-serif;
    ">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;
        background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></div>

      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:18px 24px; background:#161f30;
        border-bottom:1px solid rgba(201,168,76,0.15);
        flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:40px;height:40px;border-radius:10px;
            background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);
            display:flex;align-items:center;justify-content:center;font-size:18px;">📊</div>
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:17px;color:#ece9e0;">
              Simplex — ${entry.type}
            </div>
            <div style="font-size:12px;color:#6a7590;margin-top:2px;">${t}</div>
          </div>
        </div>
        <button onclick="closeSxModal()" style="
          width:34px;height:34px;border-radius:8px;
          border:1px solid rgba(201,168,76,0.2);
          background:rgba(201,168,76,0.05);
          color:#6a7590;font-size:16px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
        ">✕</button>
      </div>

      <div id="sxModalBody" style="
        overflow-y:auto; padding:24px; flex:1;
        scrollbar-width:thin; scrollbar-color:rgba(201,168,76,0.3) transparent;
      ">
        ${solSummary}
        ${detailContent}
      </div>

      <div style="
        padding:16px 24px;
        border-top:1px solid rgba(201,168,76,0.15);
        background:#161f30;
        display:flex; align-items:center; gap:10px;
        flex-shrink:0; flex-wrap:wrap;
      ">
        <div style="flex:1;font-size:12px;color:#4a5568;">
          ${entry.constraints ? entry.constraints.length + ' batasan' : ''}
          ${hasDetail ? ' · <span style="color:rgba(74,222,128,0.8);">✓ detail lengkap</span>' : ''}
        </div>

        ${hasDetail ? `
        <button onclick="exportSxModalPDF()" style="
          display:inline-flex;align-items:center;gap:8px;
          padding:9px 18px;border-radius:9px;
          background:linear-gradient(135deg,#c0392b,#e74c3c);
          border:none;color:#fff;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
          cursor:pointer;
        ">📄 Unduh PDF</button>` : ''}

        <button onclick="downloadSingleHistory('${id}')" style="
          display:inline-flex;align-items:center;gap:8px;
          padding:9px 18px;border-radius:9px;
          background:rgba(201,168,76,0.1);
          border:1px solid rgba(201,168,76,0.3);color:#c9a84c;
          font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
          cursor:pointer;
        ">⬇ Unduh .txt</button>

        <button onclick="deleteHistoryItem('${id}');closeSxModal()" style="
          display:inline-flex;align-items:center;gap:8px;
          padding:9px 18px;border-radius:9px;
          background:transparent;
          border:1px solid rgba(248,113,113,0.25);color:#f87171;
          font-family:'DM Sans',sans-serif;font-size:13px;
          cursor:pointer;
        ">🗑 Hapus</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function closeSxModal() {
  const m = document.getElementById('sxModal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

function exportSxModalPDF() {
  if (typeof exportToPDF !== 'function') { alert('Library PDF belum siap.'); return; }
  var modalBody = document.getElementById('sxModalBody');
  if (!modalBody) return;
  var tmp = document.createElement('div');
  tmp.id = '_sxPdfTemp';
  tmp.style.cssText = 'position:fixed;top:-99999px;left:0;width:860px;z-index:-1;background:#0f1624;padding:32px 36px;';
  tmp.innerHTML = modalBody.innerHTML;
  document.body.appendChild(tmp);
  exportToPDF('_sxPdfTemp', 'TRO_Simplex_Detail', null);
  setTimeout(function() {
    var el = document.getElementById('_sxPdfTemp');
    if (el) el.remove();
  }, 15000);
}

// ── RENDER HISTORY PANEL ──
function renderHistoryPanel() {
  const c = document.getElementById('simplexHistory');
  if (!c) return;
  const h = getSimplexHistory();

  if (!h.length) {
    c.innerHTML = `
      <div style="padding:32px;text-align:center;">
        <div style="font-size:32px;margin-bottom:10px;opacity:0.4;">📊</div>
        <div style="font-size:13px;color:var(--muted);font-style:italic;">
          Belum ada riwayat. Selesaikan perhitungan pertama.
        </div>
      </div>`;
    return;
  }

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 20px;background:rgba(201,168,76,0.04);
      border-bottom:1px solid rgba(201,168,76,0.1);">
      <span style="font-size:11px;color:var(--muted);">${h.length} riwayat tersimpan</span>
      <div style="display:flex;gap:8px;">
        <button onclick="downloadHistory()" style="
          padding:5px 12px;border-radius:7px;font-size:11px;cursor:pointer;
          font-family:'DM Sans',sans-serif;
          background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);color:var(--gold);
        ">⬇ Unduh .txt</button>
        <button onclick="clearAllHistory()" style="
          padding:5px 12px;border-radius:7px;font-size:11px;cursor:pointer;
          font-family:'DM Sans',sans-serif;
          background:transparent;border:1px solid rgba(248,113,113,0.2);color:#f87171;
        ">🗑 Hapus Semua</button>
      </div>
    </div>
    <div style="max-height:320px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.3) transparent;">`;

  h.forEach((e) => {
    const t = new Date(e.timestamp).toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const zStr = e.result && e.result.z !== undefined ? e.result.z.toFixed(3) : '';
    const hasDetail = !!e.fullHtml;
    const isMax = e.type === 'Maksimasi';

    html += `
      <div onclick="openSimplexModal('${e.id}')" style="
        display:flex;align-items:center;gap:14px;
        padding:14px 20px;cursor:pointer;
        border-bottom:1px solid rgba(201,168,76,0.06);
        transition:background 0.18s;
      " onmouseover="this.style.background='rgba(201,168,76,0.05)'"
         onmouseout="this.style.background='transparent'">

        <div style="
          width:38px;height:38px;border-radius:10px;flex-shrink:0;
          background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);
          display:flex;align-items:center;justify-content:center;font-size:16px;
        ">📊</div>

        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:var(--text);font-weight:500;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;">
            ${e.type} — <span style="font-size:12px;color:var(--muted);">Z = ${e.objective}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);">
            ${t}
            ${e.constraints ? `· ${e.constraints.length} batasan` : ''}
            ${hasDetail ? `· <span style="color:rgba(74,222,128,0.7);">✓ detail</span>` : ''}
          </div>
        </div>

        ${zStr ? `
          <div style="
            flex-shrink:0;
            background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);
            border-radius:8px;padding:5px 10px;text-align:center;
          ">
            <div style="font-size:10px;color:var(--muted);margin-bottom:2px;">${isMax?'Maks':'Min'}</div>
            <div style="font-size:13px;color:var(--gold);font-weight:600;">${zStr}</div>
          </div>` : ''}

        <button onclick="event.stopPropagation();deleteHistoryItem('${e.id}')" style="
          flex-shrink:0;width:28px;height:28px;border-radius:7px;
          border:1px solid rgba(248,113,113,0.15);
          background:transparent;color:rgba(248,113,113,0.5);
          font-size:13px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
        " title="Hapus">✕</button>
      </div>`;
  });

  html += '</div>';
  c.innerHTML = html;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSxModal(); });