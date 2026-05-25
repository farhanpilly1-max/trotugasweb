// ============================================================
// FILE: js/history.js
// FULL HISTORY SYSTEM — TRO
// ============================================================

const HISTORY_KEY = 'tro_history';

// ============================================================
// GET HISTORY
// ============================================================

function getHistory() {

  try {

    return JSON.parse(
      localStorage.getItem(HISTORY_KEY) || '[]'
    );

  } catch {

    return [];

  }
}

// ============================================================
// SAVE HISTORY
// ============================================================

function saveHistory(entries) {

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(entries)
  );
}

// ============================================================
// ADD HISTORY
// ============================================================

function addHistoryEntry(entry, solutionHtml) {

  const entries = getHistory();

  entry.id =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6);

  entry.timestamp =
    new Date().toISOString();

  // =========================================================
  // SAVE FULL HTML
  // =========================================================

  entry.fullHtml = solutionHtml;

  entries.unshift(entry);

  // maksimal 100 history

  if (entries.length > 100) {

    entries.length = 100;

  }

  saveHistory(entries);

  renderHistoryPanel();

  return entry.id;
}

// ============================================================
// DELETE HISTORY
// ============================================================

function deleteHistoryEntry(id) {

  const entries =
    getHistory().filter(
      e => e.id !== id
    );

  saveHistory(entries);

  renderHistoryPanel();
}

// ============================================================
// CLEAR ALL
// ============================================================

function clearHistory() {

  if (
    !confirm(
      'Hapus semua riwayat perhitungan?'
    )
  ) return;

  localStorage.removeItem(HISTORY_KEY);

  renderHistoryPanel();
}

// ============================================================
// DOWNLOAD ALL HISTORY
// ============================================================

function downloadHistory() {

  const entries = getHistory();

  if (!entries.length) {

    alert('Belum ada riwayat.');

    return;
  }

  let text = '';

  text += '=====================================================\n';
  text += '              TRO — RIWAYAT PERHITUNGAN\n';
  text += '=====================================================\n\n';

  entries.forEach((e, i) => {

    text += `-----------------------------------------------------\n`;
    text += `RIWAYAT ${i + 1}\n`;
    text += `-----------------------------------------------------\n`;

    text += `Metode : ${e.method}\n`;
    text += `Jenis  : ${e.type || '-'}\n`;

    text += `Waktu  : ${new Date(
      e.timestamp
    ).toLocaleString('id-ID')}\n`;

    if (e.objective) {

      text += `\nFungsi Tujuan:\n`;
      text += `Z = ${e.objective}\n`;
    }

    if (
      e.constraints &&
      e.constraints.length
    ) {

      text += `\nBatasan:\n`;

      e.constraints.forEach(c => {

        text += `• ${c}\n`;

      });
    }

    if (e.result) {

      text += `\nHasil:\n`;

      if (e.result.variables) {

        e.result.variables.forEach(
          (v, i) => {

            text += `x${i + 1} = ${v}\n`;

          }
        );
      }

      if (
        e.result.z !== undefined
      ) {

        text += `Z = ${e.result.z}\n`;

      }
    }

    text += '\n\n';
  });

  const blob = new Blob(
    [text],
    {
      type:
        'text/plain;charset=utf-8'
    }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;

  a.download =
    'TRO_Riwayat.txt';

  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================
// DOWNLOAD SINGLE HISTORY
// ============================================================

function downloadSingle(id) {

  const e =
    getHistory().find(
      x => x.id === id
    );

  if (!e) return;

  let text = '';

  text += '=====================================================\n';
  text += '               TRO — DETAIL RIWAYAT\n';
  text += '=====================================================\n\n';

  text += `Metode : ${e.method}\n`;
  text += `Jenis  : ${e.type || '-'}\n`;

  text += `Waktu  : ${new Date(
    e.timestamp
  ).toLocaleString('id-ID')}\n`;

  if (e.objective) {

    text += `\nFungsi Tujuan:\n`;
    text += `Z = ${e.objective}\n`;

  }

  if (
    e.constraints &&
    e.constraints.length
  ) {

    text += `\nBatasan:\n`;

    e.constraints.forEach(c => {

      text += `• ${c}\n`;

    });
  }

  if (e.result) {

    text += `\nHasil:\n`;

    if (e.result.variables) {

      e.result.variables.forEach(
        (v, i) => {

          text += `x${i + 1} = ${v}\n`;

        }
      );
    }

    if (
      e.result.z !== undefined
    ) {

      text += `Z = ${e.result.z}\n`;

    }
  }

  const blob = new Blob(
    [text],
    { type: 'text/plain' }
  );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;

  a.download =
    `TRO_${e.method}_${e.id}.txt`;

  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================
// OPEN MODAL
// ============================================================

function openHistoryModal(id) {

  const entry =
    getHistory().find(
      e => e.id === id
    );

  if (!entry) return;

  const html =
    entry.fullHtml || '';

  const modalHtml = `

  <div class="modal-overlay"
       id="historyModal"
       onclick="if(event.target===this)closeModal()">

    <div class="modal-box">

      <div class="modal-header">

        <div>

          <div class="modal-title">

            📈 ${entry.method}

          </div>

          <div class="modal-meta">

            ${new Date(
              entry.timestamp
            ).toLocaleString('id-ID')}

          </div>

        </div>

        <button class="modal-close"
                onclick="closeModal()">

          ✕

        </button>

      </div>

      <div class="modal-body">

        ${html}

      </div>

      <div class="modal-footer">

        <button class="btn-hist-action btn-dl"
                onclick="downloadSingle('${entry.id}')">

          ⬇ Download

        </button>

        <button class="btn-hist-action btn-clr"
                onclick="
                  deleteHistoryEntry('${entry.id}');
                  closeModal();
                ">

          🗑 Hapus

        </button>

      </div>

    </div>

  </div>
  `;

  document.body.insertAdjacentHTML(
    'beforeend',
    modalHtml
  );

  document.body.style.overflow =
    'hidden';

  // =========================================================
  // REDRAW CANVAS
  // =========================================================

  setTimeout(() => {

    if (
      typeof redrawHistoryCanvas ===
      'function'
    ) {

      redrawHistoryCanvas(entry.id);

    }

  }, 200);
}

// ============================================================
// CLOSE MODAL
// ============================================================

function closeModal() {

  const m =
    document.getElementById(
      'historyModal'
    );

  if (m) {

    m.remove();

  }

  document.body.style.overflow = '';
}

// ============================================================
// RENDER PANEL
// ============================================================

function renderHistoryPanel() {

  const ids = [

    'simplexHistory',
    'persamaanHistory',
    'grafikHistory',
    'historyPanel'

  ];

  ids.forEach(cid => {

    const c =
      document.getElementById(cid);

    if (!c) return;

    const allEntries =
      getHistory();

    let entries = allEntries;

    // =======================================================
    // FILTER
    // =======================================================

    if (cid === 'simplexHistory') {

      entries =
        allEntries.filter(
          e => e.method === 'Simplex'
        );
    }

    else if (
      cid === 'persamaanHistory'
    ) {

      entries =
        allEntries.filter(
          e => e.method === 'Persamaan'
        );
    }

    else if (
      cid === 'grafikHistory'
    ) {

      entries =
        allEntries.filter(
          e => e.method === 'Grafik'
        );
    }

    // =======================================================
    // EMPTY
    // =======================================================

    if (!entries.length) {

      c.innerHTML = `

      <div class="history-empty">

        Belum ada riwayat perhitungan.

      </div>
      `;

      return;
    }

    // =======================================================
    // HEADER
    // =======================================================

    let html = `

    <div class="history-actions-bar">

      <span class="history-count">

        ${entries.length} Riwayat

      </span>

      <div class="history-actions">

        <button class="btn-hist-action btn-dl"
                onclick="downloadHistory()">

          ⬇ Download

        </button>

        <button class="btn-hist-action btn-clr"
                onclick="clearHistory()">

          🗑 Hapus Semua

        </button>

      </div>

    </div>

    <div class="history-list">
    `;

    // =======================================================
    // ITEMS
    // =======================================================

    entries.forEach(e => {

      const zStr =

        e.result &&
        e.result.z !== undefined

          ? `Z = ${Number(
              e.result.z
            ).toFixed(2)}`

          : '';

      html += `

      <div class="history-item"
           onclick="openHistoryModal('${e.id}')">

        <div class="history-item-left">

          <div class="history-item-icon">

            📈

          </div>

          <div>

            <div class="history-item-title">

              ${e.method}
              — ${e.type || ''}

            </div>

            <div class="history-item-meta">

              ${new Date(
                e.timestamp
              ).toLocaleString('id-ID')}

            </div>

          </div>

        </div>

        <div class="history-item-right">

          <div class="history-item-z">

            ${zStr}

          </div>

          <button class="history-del-btn"
                  onclick="
                    event.stopPropagation();
                    deleteHistoryEntry('${e.id}');
                  ">

            ✕

          </button>

        </div>

      </div>
      `;
    });

    html += `</div>`;

    c.innerHTML = html;
  });
}

// ============================================================
// ESC CLOSE
// ============================================================

document.addEventListener(
  'keydown',
  e => {

    if (e.key === 'Escape') {

      closeModal();

    }
  }
);