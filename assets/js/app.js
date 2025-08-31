// ====== Drive Upload (iframe + postMessage) ======
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwunP4YAd4OeCGy31QxOy5N6DKZr2sS3kxkLxEO128iojuD8VIGATgw3Y4N97Jbvs4/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

function sanitizeFilename(name){
  let s = String(name || '').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g, '');
  s = s.replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  if (!s) s = 'Маман';
  return s.slice(0, 80);
}
function ymd(d=new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

// Тек #screen-result HTML-ды аламыз (DOM-нұсқасын сервер PDF-ке айналдырады)
function _buildResultHtml(){
  const node = document.querySelector('#screen-result');
  if (!node) throw new Error('Нәтиже беті табылмады');
  // Минималды инлайн стиль (басып шығаруға ұқсас)
  const css = `
    <style>
      body{font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:24px}
      .card.inner{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 12px}
      h1,h2,h3{margin:0 0 10px}
      .bars .barrow{display:grid;grid-template-columns:1fr 2fr 60px;gap:8px;align-items:center;margin:8px 0}
      .bartrack{height:10px;background:#f3f4f6;border-radius:999px;overflow:hidden}
      .barfill{height:10px;background:#60a5fa}
      .badge{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:999px;padding:2px 8px;font-size:12px}
      .pill{display:inline-block;background:#f1f5f9;border-radius:999px;padding:4px 10px;margin:0 0 6px;font-size:12px}
      .tip{color:#374151}
      .lead{color:#374151}
      .footer{color:#6b7280;font-size:12px;margin-top:12px}
    </style>
  `;
  return `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${node.outerHTML}</body></html>`;
}

// Iframe арқылы POST және postMessage-ті ұстау
function uploadHTML_viaIframe(filename, html, meta){
  return new Promise((resolve,reject)=>{
    const iframe = document.createElement('iframe');
    iframe.name = 'gas_upload_' + Math.random().toString(36).slice(2);
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.action = GAS_ENDPOINT;
    form.method = 'POST';
    form.enctype = 'application/x-www-form-urlencoded';
    form.target = iframe.name;
    form.style.display = 'none';

    const add = (k,v) => {
      const inp = document.createElement('input');
      inp.type = 'hidden'; inp.name = k; inp.value = v;
      form.appendChild(inp);
    };
    add('secret',  GAS_SECRET);
    add('origin',  location.origin);
    add('filename', filename);
    add('html',    html);
    add('meta',    JSON.stringify(meta || {}));

    let done = false;
    const onMsg = (ev) => {
      // Қауіпсіздік: өз доменімізден келгенін тексереміз
      if (ev.origin !== location.origin) return;
      const data = ev.data || {};
      if (!data || typeof data !== 'object') return;
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      setTimeout(()=>{ iframe.remove(); form.remove(); }, 0);
      data.ok ? resolve(data) : reject(data);
    };
    window.addEventListener('message', onMsg);

    document.body.appendChild(form);
    form.submit();

    // 25 секундтан асса — уақыт бітті деп санаймыз
    setTimeout(()=>{
      if (done) return;
      done = true;
      window.removeEventListener('message', onMsg);
      try { iframe.remove(); form.remove(); } catch(_){}
      reject({ ok:false, error:'Timeout' });
    }, 25000);
  });
}

// Негізгі экспорт батырмасы: тез print, фонмен Drive-қа жүктеу + сілтемені көрсету
async function exportPDF(){
  // Файл атауы: Маман + күн (Кирилл сақталады)
  let expert = (document.querySelector('#expertName')?.value?.trim())
            || (window.__who && window.__who.name)
            || (document.querySelector('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/, '').trim()
            || 'Маман';
  expert = sanitizeFilename(expert);
  const fname = `${expert}_${ymd(new Date())}.pdf`;

  // 1) Бірден принт (күттірмейміз)
  try { window.print(); } catch(_){}

  // 2) Серверге HTML жіберу (PDF-ті сервер жинайды)
  const meta = {
    user: (window.__who && (window.__who.phone || window.__who.name)) || expert,
    quizId: 'meyram-quiz',
    generatedAt: new Date().toISOString()
  };
  const html = _buildResultHtml();

  try {
    const resp = await uploadHTML_viaIframe(fname, html, meta);
    // UI-де нақты сілтемені көрсетеміз
    let a = document.getElementById('shareLink');
    if (!a) {
      a = document.createElement('a');
      a.id = 'shareLink';
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.marginLeft = '10px';
      const btnRow = document.getElementById('btnExport')?.parentElement;
      if (btnRow) btnRow.appendChild(a);
    }
    a.href = resp.viewUrl;
    a.textContent = 'PDF сілтемесі (ашық)';
    a.style.display = 'inline-block';
    // Соңғыны жадыға сақтаймыз — Share кнопкасы үшін
    window.__lastPdf = resp;
  } catch (e) {
    console.error('Upload error:', e);
    alert('Принт ашылды. Drive-қа жіберу сәтсіз — кейін қайталаңыз.');
  }
}

// “PDF жіберу (сілтеме ашық)” — соңғы PDF сілтемесін бір шертуге шығару
function sharePdf(){
  const info = window.__lastPdf;
  if (!info || !info.viewUrl) {
    alert('Алдымен “PDF ретінде сақтау”-ды басып, файлды жасаңыз.');
    return;
  }
  // Сілтемені жаңадан ашу
  window.open(info.viewUrl, '_blank', 'noopener');
}

// Батырмаларға байлау (бар JS-іңнің соңында бір рет орында)
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('btnExport');
  const shareBtn  = document.getElementById('btnShare');
  if (exportBtn) exportBtn.addEventListener('click', exportPDF);
  if (shareBtn)  shareBtn.addEventListener('click', sharePdf);
});
