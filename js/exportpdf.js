// ============================================================
// exportpdf.js — Unduh PDF dengan loading indicator
// Tidak freeze: overlay tampil dulu, proses berat di setTimeout
// ============================================================

(function injectPdfStyles() {
  if (document.getElementById('_tro_pdf_style')) return;
  var s = document.createElement('style');
  s.id = '_tro_pdf_style';
  s.textContent = `
    .btn-pdf {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 22px; border-radius: 9px;
      background: linear-gradient(135deg, #c0392b, #e74c3c);
      border: none; color: #fff;
      font-family: 'DM Sans', sans-serif; font-size: 13px;
      font-weight: 600; cursor: pointer; letter-spacing: 0.3px;
      transition: opacity 0.2s, transform 0.15s; white-space: nowrap;
    }
    .btn-pdf:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .btn-pdf:active:not(:disabled) { transform: translateY(0); }
    .btn-pdf:disabled { opacity: 0.5; cursor: not-allowed; }

    .pdf-bar {
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 24px; padding: 14px 20px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
    }
    .pdf-bar-text { font-size: 13px; color: var(--muted); flex: 1; }

    /* ── OVERLAY — tampil SEBELUM proses berat ── */
    .pdf-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(8,12,24,0.92);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 0;
    }
    .pdf-overlay-box {
      background: #0f1624;
      border: 1px solid rgba(201,168,76,0.4);
      border-radius: 20px; padding: 36px 48px;
      text-align: center; min-width: 300px; max-width: 380px;
      position: relative; overflow: hidden;
    }
    .pdf-overlay-box::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, #c9a84c, transparent);
    }
    .pdf-overlay-icon {
      font-size: 42px; margin-bottom: 14px; display: block;
      animation: pdfBounce 1.1s ease-in-out infinite;
    }
    @keyframes pdfBounce {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    .pdf-overlay-title {
      font-family: 'Playfair Display', serif;
      font-size: 18px; color: #ece9e0; margin-bottom: 6px;
    }
    .pdf-overlay-msg {
      font-size: 13px; color: #6a7590; margin-bottom: 20px;
      min-height: 20px; transition: all 0.3s;
    }
    .pdf-overlay-bar-wrap {
      width: 100%; height: 6px; background: rgba(201,168,76,0.15);
      border-radius: 6px; overflow: hidden; margin-bottom: 14px;
    }
    .pdf-overlay-bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #c9a84c, #e8c97a);
      border-radius: 6px; transition: width 0.5s ease;
    }
    .pdf-overlay-tip {
      font-size: 11px; color: rgba(106,117,144,0.7);
      font-style: italic;
    }

    .pdf-toast {
      position: fixed; bottom: 28px; right: 24px; z-index: 9998;
      padding: 12px 20px; border-radius: 12px;
      font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 320px;
    }
    .pdf-toast.ok  { background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.3); color: #4ade80; }
    .pdf-toast.err { background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); color: #f87171; }
    .pdf-toast.warn{ background: rgba(251,191,36,0.12);  border: 1px solid rgba(251,191,36,0.3);  color: #fbbf24; }
  `;
  document.head.appendChild(s);
})();

// ── Fungsi utama ──────────────────────────────────────────────
function exportToPDF(containerId, filename, btnEl) {
  var el = document.getElementById(containerId);
  if (!el || !el.innerHTML.trim()) {
    pdfToast('⚠️ Selesaikan perhitungan terlebih dahulu.', 'warn'); return;
  }
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    pdfToast('⏳ Library belum siap, tunggu sebentar lalu coba lagi.', 'warn'); return;
  }

  // Disable tombol
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '⏳ Menyiapkan...'; }

  // Tampilkan overlay DULU — beri browser 1 frame untuk render overlay
  // baru mulai proses berat (tidak freeze)
  var overlay = showPdfOverlay();

  // requestAnimationFrame x2 memastikan overlay benar-benar tampil di layar
  // sebelum html2canvas mulai memblok thread
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      // Tambah sedikit delay lagi untuk HP yang lambat
      setTimeout(function() {
        _runExport(el, filename, btnEl, overlay);
      }, 80);
    });
  });
}

async function _runExport(el, filename, btnEl, overlay) {
  try {
    setOvProgress(overlay, 10, 'Menyiapkan konten...');
    await tick();

    // Clone elemen
    var clone = el.cloneNode(true);
    // KUNCI: position:absolute + top:-99999px agar tidak terlihat user
    // tapi browser tetap render full height (bukan hanya visible area)
    clone.style.cssText = [
      'position:absolute',
      'top:-99999px',
      'left:0',
      'width:820px',
      'z-index:-9999',
      'background:#0f1624',
      'color:#ece9e0',
      'padding:28px 32px',
      'font-family:DM Sans,sans-serif',
      'pointer-events:none',
      'overflow:visible',   // PENTING: jangan clip konten
      'max-height:none',    // PENTING: hapus max-height dari modal
      'height:auto'
    ].join(';');

    // Hapus semua overflow:hidden/auto dari child elements
    // agar html2canvas bisa capture semua konten
    clone.querySelectorAll('*').forEach(function(node) {
      var style = node.style;
      if (style.overflow === 'hidden' || style.overflow === 'auto' ||
          style.overflowY === 'hidden' || style.overflowY === 'auto') {
        style.overflow = 'visible';
        style.overflowY = 'visible';
        style.maxHeight = 'none';
        style.height = 'auto';
      }
    });

    // Salin canvas (grafik) ke clone
    var srcCanvases = el.querySelectorAll('canvas');
    var dstCanvases = clone.querySelectorAll('canvas');
    srcCanvases.forEach(function(sc, i) {
      if (!dstCanvases[i]) return;
      dstCanvases[i].width  = sc.width;
      dstCanvases[i].height = sc.height;
      dstCanvases[i].getContext('2d').drawImage(sc, 0, 0);
    });

    document.body.appendChild(clone);
    setOvProgress(overlay, 25, 'Mengukur halaman...');
    await tick();

    // Ukur tinggi penuh setelah di-render browser
    var fullHeight = clone.scrollHeight || clone.offsetHeight;

    setOvProgress(overlay, 35, 'Merender gambar... (proses ini butuh beberapa detik)');
    await tick();

    // html2canvas — proses paling berat
    var canvas = await html2canvas(clone, {
      scale: 1.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0f1624',
      logging: false,
      width: 820,
      height: fullHeight,
      windowWidth: 860,
      scrollX: 0,
      scrollY: 0,
      onclone: function() {
        setOvProgress(overlay, 55, 'Memproses elemen...');
      }
    });

    document.body.removeChild(clone);
    setOvProgress(overlay, 68, 'Gambar selesai, menyusun PDF...');
    await tick();

    // Buat PDF
    var { jsPDF } = window.jspdf;
    var pdf  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    var pgW  = pdf.internal.pageSize.getWidth();
    var pgH  = pdf.internal.pageSize.getHeight();
    var marg = 12;
    var cntW = pgW - marg * 2;
    var hdH  = 13;
    var ftH  = 10;
    var cntH = pgH - marg * 2 - hdH - ftH;

    var pxToMm = 0.264583;
    var scale  = cntW / (canvas.width * pxToMm);
    var totalH = canvas.height * pxToMm * scale;
    var pages  = Math.ceil(totalH / cntH);
    var now    = new Date().toLocaleString('id-ID', { dateStyle:'long', timeStyle:'short' });

    setOvProgress(overlay, 72, 'Membuat ' + pages + ' halaman PDF...');
    await tick();

    for (var p = 0; p < pages; p++) {
      if (p > 0) pdf.addPage();

      // Progress per halaman
      var pct = 72 + Math.round((p / pages) * 20);
      setOvProgress(overlay, pct, 'Halaman ' + (p+1) + ' dari ' + pages + '...');

      // Background
      pdf.setFillColor(15, 22, 36);
      pdf.rect(0, 0, pgW, pgH, 'F');

      // Header
      pdf.setDrawColor(201, 168, 76); pdf.setLineWidth(0.4);
      pdf.line(marg, marg+hdH-1, pgW-marg, marg+hdH-1);
      pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
      pdf.setTextColor(201, 168, 76);
      pdf.text('TRO — Teknik Riset Operasi', marg, marg+5);
      pdf.setFont('helvetica','normal'); pdf.setTextColor(106, 117, 144);
      pdf.text('Hal. '+(p+1)+' / '+pages, pgW-marg, marg+5, { align:'right' });

      // Slice
      var srcYpx = (p * cntH / scale) / pxToMm;
      var slHpx  = Math.min((cntH / scale) / pxToMm, canvas.height - srcYpx);
      var slCanvas = document.createElement('canvas');
      slCanvas.width  = canvas.width;
      slCanvas.height = Math.ceil(slHpx);
      var slCtx = slCanvas.getContext('2d');
      slCtx.fillStyle = '#0f1624';
      slCtx.fillRect(0, 0, slCanvas.width, slCanvas.height);
      slCtx.drawImage(canvas, 0, -srcYpx);

      pdf.addImage(
        slCanvas.toDataURL('image/jpeg', 0.72), 'JPEG',
        marg, marg+hdH, cntW, slHpx*pxToMm*scale
      );

      // Footer
      pdf.setDrawColor(201,168,76); pdf.setLineWidth(0.3);
      pdf.line(marg, pgH-marg-ftH+2, pgW-marg, pgH-marg-ftH+2);
      pdf.setFontSize(8); pdf.setTextColor(106,117,144);
      pdf.text('Dicetak: '+now, marg, pgH-marg-2);
      pdf.text(filename, pgW-marg, pgH-marg-2, { align:'right' });
    }

    setOvProgress(overlay, 95, 'Menyimpan file...');
    await tick();

    pdf.save(filename + '_' + new Date().toISOString().slice(0,10) + '.pdf');

    setOvProgress(overlay, 100, 'Selesai! ✅');
    setTimeout(function() { rmOverlay(overlay); }, 900);
    pdfToast('✅ PDF berhasil disimpan!', 'ok');

  } catch(err) {
    console.error(err);
    rmOverlay(overlay);
    pdfToast('❌ Gagal: ' + err.message, 'err');
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '⬇ Unduh PDF'; }
  }
}

// Beri browser 1 frame untuk update UI
function tick() {
  return new Promise(function(resolve) {
    requestAnimationFrame(function() { setTimeout(resolve, 16); });
  });
}

// ── Shortcut per halaman ──────────────────────────────────────
function exportSimplexPDF(btn)   { exportToPDF('simplexResult',   'TRO_Simplex',   btn); }
function exportPersamaanPDF(btn) { exportToPDF('persamaanResult', 'TRO_Persamaan', btn); }
function exportGrafikPDF(btn)    { exportToPDF('grafikResult',    'TRO_Grafik',    btn); }

// ── Overlay helpers ───────────────────────────────────────────
function showPdfOverlay() {
  var o = document.createElement('div');
  o.className = 'pdf-overlay';
  o.id = '_pdfOverlay';
  o.innerHTML =
    '<div class="pdf-overlay-box">' +
    '<span class="pdf-overlay-icon">📄</span>' +
    '<div class="pdf-overlay-title">Membuat PDF</div>' +
    '<div class="pdf-overlay-msg" id="_pdfMsg">Menyiapkan...</div>' +
    '<div class="pdf-overlay-bar-wrap"><div class="pdf-overlay-bar" id="_pdfBar"></div></div>' +
    '<div class="pdf-overlay-tip">Jangan tutup halaman ini</div>' +
    '</div>';
  document.body.appendChild(o);
  document.body.style.overflow = 'hidden';
  return o;
}

function setOvProgress(o, pct, msg) {
  var bar   = document.getElementById('_pdfBar');
  var msgEl = document.getElementById('_pdfMsg');
  if (bar)   bar.style.width = pct + '%';
  if (msgEl) msgEl.textContent = msg;
}

function rmOverlay(o) {
  if (o && o.parentNode) o.parentNode.removeChild(o);
  document.body.style.overflow = '';
}

function pdfToast(msg, type) {
  var t = document.createElement('div');
  t.className = 'pdf-toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() {
    t.style.transition = 'opacity 0.4s'; t.style.opacity = '0';
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
  }, 3500);
}