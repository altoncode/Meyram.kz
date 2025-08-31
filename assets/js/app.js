// Meyram Quiz — app.js
// TZ: Asia/Almaty (UTC+5)

// === Google Apps Script конфиг ======================
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzZUFbtDNt3XRiYEBIo8oFXIXn5-GeSiKo1YQZknvo81lYAi8deWO9ejfyUnI6mLp17/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

// --- Data ---------------------------------------------------------------
const DOMAINS = {
  TH: { name: 'Мышление (Стратегиялық ойлау)', color: '#86ffda',
    desc: 'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB: { name: 'Отношения (Қарым-қатынас)', color: '#6ea8fe',
    desc: 'Команданы біріктіреді, сенім орнатады, эмпатиясы жоғары.' },
  EX: { name: 'Достигаторство (Орындау)', color: '#c8a5ff',
    desc: 'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN: { name: 'Влияние (Әсер ету)', color: '#ffd28a',
    desc: 'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' }
};

const QUESTIONS = [
  { t: 'Маған ойлануға, жалғыз отырып жоспар құруға уақыт қажет.', d:'TH' },
  { t: 'Жаңа идеялар ойлап табу мені шабыттандырады.', d:'TH' },
  { t: 'Ақпаратты терең талдауды ұнатамын.', d:'TH' },
  { t: 'Күрделі мәселелерді шешкенде өзімді мықты сезінемін.', d:'TH' },
  { t: 'Болашақ туралы стратегия құру маған қуат береді.', d:'TH' },

  { t: 'Мен адамдарды біріктіріп, жылы атмосфера жасағанды жақсы көремін.', d:'RB' },
  { t: 'Командадағы достық маған нәтижеден де маңызды.', d:'RB' },
  { t: 'Адамдардың сезімін тез түсінемін.', d:'RB' },
  { t: 'Біреуге қолдау көрсеткенде өзімді бақытты сезінемін.', d:'RB' },
  { t: 'Қарым-қатынаста сенім – мен үшін ең бастысы.', d:'RB' },

  { t: 'Жоспар құрсам, міндетті түрде соңына дейін жеткіземін.', d:'EX' },
  { t: 'Маған нақты тапсырма мен дедлайн берілсе, жақсы жұмыс істеймін.', d:'EX' },
  { t: 'Тәртіп пен жүйелілік маған күш береді.', d:'EX' },
  { t: 'Бір күнді бос өткізсем, өзімді жайсыз сезінемін.', d:'EX' },
  { t: 'Мақсатқа жету жолында кедергілерден қаймықпаймын.', d:'EX' },

  { t: 'Көпшілік алдында сөйлегенді ұнатамын.', d:'IN' },
  { t: 'Басқаларды сендіріп, өз идеяма тарту қолымнан келеді.', d:'IN' },
  { t: 'Командада көшбасшы болу маған табиғи көрінеді.', d:'IN' },
  { t: 'Таныс емес адамдармен тез тіл табысамын.', d:'IN' },
  { t: 'Жаңа бастаманы бастауға өзгелерді ерте аламын.', d:'IN' }
];

// --- State --------------------------------------------------------------
let current = 0; // 0..19
const answers = new Array(QUESTIONS.length).fill(null); // 0..4 scale, null = skipped
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20; // seconds

const LS_KEY = 'meyram-quiz-v1';

// --- Helpers ------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
// Қауіпсіз байлау: элемент жоқ болса — тыныш өтеміз
function on(sel, ev, handler){
  const el = $(sel);
  if (el) el.addEventListener(ev, handler);
  else console.warn('Element not found for listener:', sel);
}

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

// regex-ке тәуелсіз, қауіпсіз filename тазарту
function sanitizeFilename(name){
  const s = String(name || 'unknown').trim();
  const allowed = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-';
  let out = '';
  for (const ch of s) out += allowed.indexOf(ch) !== -1 ? ch : '_';
  // қатар '_' қысқарту
  let compact = '', prevUnd = false;
  for (const ch of out){
    if (ch === '_'){ if (!prevUnd) compact += '_'; prevUnd = true; }
    else { compact += ch; prevUnd = false; }
  }
  return compact.length > 80 ? compact.slice(0,80) : compact;
}

function formatDateYMD(d=new Date()){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function blobToDataURL(blob){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// === CORS-safe upload: no-cors + кейін жаңа табта ашу ===================
async function uploadPdfToDrive(pdfBlob, meta={}, filename){
  const dataURL = await blobToDataURL(pdfBlob);
  const payload = {
    filename: filename || `meyram-${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    base64: dataURL,
    meta
  };
  const url = GAS_ENDPOINT + '?secret=' + encodeURIComponent(GAS_SECRET);

  // CORS-ты айналып өту: no-cors, жауапты оқымаймыз
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  // Біз жауапты оқымаймыз, сондықтан жай ok деп қайтарамыз
  return { ok: true };
}

async function makePdfFromDom(selector, options={}){
  const { margin = 10 } = options; // мм
  const el = document.querySelector(selector);
  if(!el) throw new Error('Нәтиже DOM табылмады: '+selector);

  if (typeof html2canvas !== 'function' || !window.jspdf?.jsPDF) {
    throw new Error('PDF кітапханалары жүктелмеген (html2canvas/jsPDF).');
  }

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new window.jspdf.jsPDF('p','mm','a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - margin*2;

  const imgProps = pdf.getImageProperties(imgData);
  const imgW = usableW;
  const imgH = (imgProps.height * imgW) / imgProps.width;

  let x = margin, y = margin;
  pdf.addImage(imgData, 'PNG', x, y, imgW, imgH, undefined, 'FAST');

  // Егер биіктік көп болса — бірнеше бетке "сырғытып" басамыз
  let position = y;
  while ((imgH + position) > pageH - margin) {
    position -= (pageH - margin*2);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', x, position, imgW, imgH, undefined, 'FAST');
  }
  return pdf;
}

// --- Quiz rendering -----------------------------------------------------
function renderQuestion(){
  const q = QUESTIONS[current];

  // Мәтіндер мен прогресс
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const answeredCount = answers.filter(v => v != null).length;
  const p = Math.round((answeredCount / QUESTIONS.length) * 100);
  $('#progress').style.width = p + '%';

  // Шкала
  const labels = [
    'Мүлде сәйкес келмейді',
    'Көбірек сәйкес келмейді',
    'Бейтарап',
    'Көбірек сәйкес келеді',
    'Өте сәйкес келеді'
  ];

  const scale = $('#scale');
  scale.innerHTML = '';
  scale.setAttribute('role','radiogroup');
  scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx) => {
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.setAttribute('role','radio');
    opt.setAttribute('aria-checked', answers[current] === idx ? 'true' : 'false');
    opt.setAttribute('tabindex','0'); // пернетақта қолдауы

    const text = document.createElement('span');
    text.textContent = lab;

    // Нақты input (iOS үшін change-ті тыңдаймыз)
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q${current}`;
    input.value = String(idx);
    input.tabIndex = -1; // фокусты opt алады
    input.style.pointerEvents = 'none'; // екі-қадамды болдырмау

    if (answers[current] === idx) {
      input.checked = true;
      opt.classList.add('active');
    }

    input.addEventListener('change', () => {
      answers[current] = idx;
      $$('.opt').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active');
      opt.setAttribute('aria-checked','true');
      saveState();
      // автокөшуді тек таймер қосулы кезде ғана жасаймыз
      if (useTimer) setTimeout(() => move(1), 120);
    });

    // Бір қадамда таңдау
    opt.addEventListener('click', () => input.click());
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    opt.append(text, input);
    scale.appendChild(opt);
  });

  // Таймер UI
  if (useTimer) {
    $('#timerPill').style.display = 'inline-flex';
    startTimer(PER_QUESTION, () => move(1));
  } else {
    $('#timerPill').style.display = 'none';
    stopTimer();
  }

  // Батырмалар
  $('#btnBack').disabled = (current === 0);
}

function move(delta){
  stopTimer();
  current += delta;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){
    showResult();
    return;
  }
  saveState();
  renderQuestion();
}

function startTimer(sec, onDone){
  let left = sec;
  $('#timer').textContent = left;
  timerId = setInterval(()=>{
    left--; $('#timer').textContent = left;
    if(left<=0){ stopTimer(); onDone && onDone(); }
  }, 1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  // bucket per domain
  const per = { TH: [], RB: [], EX: [], IN: [] };
  QUESTIONS.forEach((q, i)=> per[q.d].push(answers[i]));

  const raw = {}, norm = {};
  for (const [k, arr] of Object.entries(per)) {
    const answered = arr.filter(v => v != null);
    const sum = answered.reduce((a,b)=> a + Number(b), 0);
    const denom = Math.max(answered.length * 4, 1);
    raw[k] = sum;
    norm[k] = Math.round((sum / denom) * 100);
  }

  const maxRaw = Math.max(...Object.values(raw));
  const top = Object.entries(raw).filter(([,v]) => v === maxRaw).map(([k]) => k);
  return { raw, norm, top };
}

function showResult(){
  $('#progress').style.width = '100%';

  const {raw, norm, top} = compute();

  // Маман аты
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  // Title/desc
  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  const tie = top.length>1;
  $('#topDesc').textContent = tie
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : DOMAINS[top[0]].desc;

  // Bars
  const bars = $('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row = document.createElement('div'); row.className = 'barrow';
    const lab = document.createElement('div'); lab.innerHTML = `<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track = document.createElement('div'); track.className='bartrack';
    const fill = document.createElement('div'); fill.className='barfill';
    fill.style.background = `linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; 
    fill.style.width = '0%';
    const pct = document.createElement('div'); pct.textContent = norm[k] + '%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab, track, pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width = norm[k] + '%'; });
  });

  // Explain / suggestions
  const ex = $('#explain'); ex.innerHTML='';
  const SUG = {
    TH: 'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB: 'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX: 'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN: 'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div = document.createElement('div');
    div.innerHTML = `<div class="pill">${DOMAINS[k].name}</div><div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  show('#screen-result');
  saveState();
}

// === PDF экспорт + Drive жүктеу ================================
async function exportPDF(){
  // Маман атын алу: input → window.__who → экрандағы текст → 'unknown'
  let expert = (function () {
    const fromInput = $('#expertName')?.value?.trim();
    if (fromInput) return fromInput;

    const fromWho = (window.__who && window.__who.name) ? String(window.__who.name).trim() : '';
    if (fromWho) return fromWho;

    const disp = $('#expertDisplay')?.textContent || '';
    const prefix = 'Маман:';
    if (disp.slice(0, prefix.length) === prefix) return disp.slice(prefix.length).trim();
    return disp.trim() || 'unknown';
  })();
  expert = sanitizeFilename(expert);

  const fileName = `${expert}_${formatDateYMD(new Date())}.pdf`;

  const meta = {
    user: (window.__who && (window.__who.phone || window.__who.name)) || expert || 'anonymous',
    city: window.__who?.city || 'kz',
    score: window.__score || 0,
    quizId: 'meyram-quiz',
    generatedAt: new Date().toISOString()
  };

  // 1) PDF жасау (нәтиже картасын аламыз)
  const pdf = await makePdfFromDom('#screen-result', { margin: 10 });

  // 2) Локалға сақтау
  pdf.save(fileName);

  // 3) Drive-қа дәл сол файлды жүктеу (CORS-safe)
  const pdfBlob = pdf.output('blob');
  try {
    await uploadPdfToDrive(pdfBlob, meta, fileName);

    // Жаңа табта соңғы файлды бірден ашамыз (CORS жүрмейді)
    const latestUrl = GAS_ENDPOINT
      + '?latest=1&secret=' + encodeURIComponent(GAS_SECRET)
      + '&user=' + encodeURIComponent(meta.user || expert);
    window.open(latestUrl, '_blank', 'noopener');

    alert('Drive-қа жіберілді ✅ (жаңа табта ашылады)');
  } catch (err) {
    console.error(err);
    alert('PDF локалға сақталды. Drive-қа жіберуде желілік шектеу болуы мүмкін — папканы тексеріңіз.');
  }
}

// --- Persistence --------------------------------------------------------
function saveState(){
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ current, answers, useTimer }));
  } catch {}
}
function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!s) return;
    useTimer = !!s.useTimer;
    const tgl = $('#timerToggle'); if (tgl) tgl.checked = useTimer;
    current = Math.min(Math.max(Number(s.current)||0,0), QUESTIONS.length-1);
    if (Array.isArray(s.answers)) s.answers.forEach((v,i)=> answers[i] = (v===null?null:Number(v)));
  } catch {}
}

// --- Events -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  on('#btnStart','click',()=>{
    // таймер күйі
    const tgl = $('#timerToggle'); useTimer = !!(tgl && tgl.checked);

    // маман атын жадыға да белгілеп қоямыз
    const name = $('#expertName')?.value?.trim();
    if (name) {
      window.__who = window.__who || {};
      window.__who.name = name;
    }

    current = 0;
    show('#screen-quiz');
    renderQuestion();
  });

  on('#btnNext','click',()=>{
    if (answers[current] == null) {
      const pill = $('#qHint');
      const old = pill?.textContent || '';
      if (pill) {
        pill.textContent = 'Алдымен жауап беріңіз 🙂';
        setTimeout(()=> { pill.textContent = old; }, 1200);
      }
      return;
    }
    move(1);
  });

  on('#btnBack','click',()=> move(-1));
  on('#btnSkip','click',()=>{ answers[current] = null; move(1); });

  on('#btnRestart','click',()=>{
    answers.fill(null);
    localStorage.removeItem(LS_KEY);
    location.reload();
  });

  on('#btnReview','click',()=>{
    show('#screen-quiz'); renderQuestion();
  });
  on('#btnExport','click', exportPDF);

  // Keyboard shortcuts
  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    const key = e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx = Number(key)-1;
      answers[current]=idx;
      saveState();
      renderQuestion();
      // тек таймер қосулы болса ғана автокөшу
      if (useTimer) setTimeout(()=> move(1), 120);
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft') move(-1);
  });

  // Visibility pause/resume timer
  document.addEventListener('visibilitychange', () => {
    if (!useTimer) return;
    if (document.hidden) {
      stopTimer();
    } else {
      startTimer(PER_QUESTION, ()=>move(1));
    }
  });
});
