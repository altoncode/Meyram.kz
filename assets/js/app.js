// Meyram Quiz — app.js
// TZ: Asia/Almaty (UTC+5)

// === Google Apps Script конфиг ======================
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycby_pziF5-mk60p5dXet0LLzvY_wZHPj9j0JdKwoz3pNu3-gUAdFGwrA0TDgQ4jRQT7P/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

// --- Data ---------------------------------------------------------------
const DOMAINS = {
  TH: { name: 'Мышление (Стратегиялық ойлау)', color: '#86ffda',
    desc: 'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB: { name: 'Отношения (Қарым-қатынас)', color: '#6ea8fe',
    desc: 'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
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
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skipped
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20; // seconds
const LS_KEY = 'meyram-quiz-v1';

// --- Helpers ------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function on(sel, ev, handler){ const el=$(sel); if(el) el.addEventListener(ev, handler); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

function sanitizeFilename(name){
  const s = String(name || 'unknown').trim();
  const allowed = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-';
  let out = '';
  for (const ch of s) out += allowed.indexOf(ch) !== -1 ? ch : '_';
  // қатар '_' қысқарту
  let compact = '', prev=false; 
  for(const ch of out){ 
    if(ch==='_'){ if(!prev) compact+='_'; prev=true; } 
    else { compact+=ch; prev=false; } 
  }
  return compact.length>80?compact.slice(0,80):compact;
}
function formatDateYMD(d=new Date()){
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function blobToDataURL(blob){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); });
}

// === CORS-safe upload: no-cors + кейін жаңа табта ашу ===================
async function uploadPdfToDrive(pdfBlob, meta={}, filename){
  const dataURL = await blobToDataURL(pdfBlob);
  const payload = { filename: filename || `meyram-${Date.now()}.pdf`, mimeType:'application/pdf', base64: dataURL, meta };
  const url = GAS_ENDPOINT + '?secret=' + encodeURIComponent(GAS_SECRET);

  // CORS-ты айналып өту: жауапты оқымаймыз (opaque)
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return { ok:true };
}

async function makePdfFromDom(selector, { margin=10 }={}){
  const el = document.querySelector(selector);
  if(!el) throw new Error('Нәтиже DOM табылмады: '+selector);
  if(typeof html2canvas!=='function' || !window.jspdf?.jsPDF) throw new Error('PDF кітапханалары жүктелмеген.');

  const canvas = await html2canvas(el, { scale:2, backgroundColor:'#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new window.jspdf.jsPDF('p','mm','a4');
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
  const usableW = pageW - margin*2;

  const imgProps = pdf.getImageProperties(imgData);
  const imgW = usableW, imgH = (imgProps.height * imgW) / imgProps.width;

  const x=margin, y=margin; pdf.addImage(imgData,'PNG',x,y,imgW,imgH,undefined,'FAST');
  let pos=y; while((imgH+pos)>pageH-margin){ pos -= (pageH - margin*2); pdf.addPage(); pdf.addImage(imgData,'PNG',x,pos,imgW,imgH,undefined,'FAST'); }
  return pdf;
}

// --- Quiz rendering -----------------------------------------------------
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const answeredCount = answers.filter(v => v != null).length;
  $('#progress').style.width = Math.round((answeredCount/QUESTIONS.length)*100) + '%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); scale.innerHTML=''; scale.setAttribute('role','radiogroup'); scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx) => {
    const opt = document.createElement('div'); opt.className='opt'; opt.setAttribute('role','radio'); opt.setAttribute('aria-checked', answers[current]===idx?'true':'false'); opt.tabIndex=0;
    const text=document.createElement('span'); text.textContent=lab;

    const input=document.createElement('input'); input.type='radio'; input.name=`q${current}`; input.value=String(idx); input.tabIndex=-1; input.style.pointerEvents='none';
    if(answers[current]===idx){ input.checked=true; opt.classList.add('active'); }

    input.addEventListener('change',()=>{
      answers[current]=idx;
      $$('.opt').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active'); opt.setAttribute('aria-checked','true');
      saveState();
      // автокөшу тек таймер қосулы кезде
      if(useTimer) setTimeout(()=>move(1),120);
    });

    opt.addEventListener('click',()=>input.click());
    opt.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); }});

    opt.append(text,input); scale.appendChild(opt);
  });

  if(useTimer){ $('#timerPill').style.display='inline-flex'; startTimer(PER_QUESTION,()=>move(1)); }
  else { $('#timerPill').style.display='none'; stopTimer(); }

  $('#btnBack').disabled = (current===0);
}

function move(delta){
  stopTimer(); current += delta;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){ showResult(); return; }
  saveState(); renderQuestion();
}

function startTimer(sec,onDone){
  let left=sec; $('#timer').textContent=left;
  timerId=setInterval(()=>{ left--; $('#timer').textContent=left; if(left<=0){ stopTimer(); onDone&&onDone(); } },1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]}; QUESTIONS.forEach((q,i)=>per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const [k,arr] of Object.entries(per)){ const answered=arr.filter(v=>v!=null); const sum=answered.reduce((a,b)=>a+Number(b),0); const denom=Math.max(answered.length*4,1); raw[k]=sum; norm[k]=Math.round((sum/denom)*100); }
  const maxRaw=Math.max(...Object.values(raw)); const top=Object.entries(raw).filter(([,v])=>v===maxRaw).map(([k])=>k);
  return { raw, norm, top };
}

function showResult(){
  $('#progress').style.width='100%';
  const { norm, top } = compute();

  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : DOMAINS[top[0]].desc;

  const bars=$('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row=document.createElement('div'); row.className='barrow';
    const lab=document.createElement('div'); lab.innerHTML=`<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track=document.createElement('div'); track.className='bartrack';
    const fill=document.createElement('div'); fill.className='barfill'; fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; fill.style.width='0%';
    const pct=document.createElement('div'); pct.textContent=norm[k]+'%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab,track,pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width=norm[k]+'%'; });
  });

  const ex=$('#explain'); ex.innerHTML='';
  const SUG={
    TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML=`<div class="pill">${DOMAINS[k].name}</div><div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  show('#screen-result'); saveState();
}

// === ТЕК Drive + Печать ================================================
async function exportPDF(){
  // Файл атауы үшін маман атын жинау
  let expert = (function(){
    const a=$('#expertName')?.value?.trim(); if(a) return a;
    const b=(window.__who&&window.__who.name)?String(window.__who.name).trim():''; if(b) return b;
    const disp=$('#expertDisplay')?.textContent||''; const prefix='Маман:'; 
    return disp.startsWith(prefix)?disp.slice(prefix.length).trim(): (disp.trim()||'unknown');
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

  // Попап-блокерге түспеу үшін жаңа табты алдын ала ашып қоямыз
  const win = window.open('about:blank', '_blank', 'noopener');

  // Печать диалогы: тек нәтижені көрсететін @media print стильдері index.html-да болуы керек
  try { window.print(); } catch(_) {}

  // Кітапханалар бар-жоғын тексеру
  if (typeof html2canvas !== 'function' || !window.jspdf?.jsPDF) {
    console.error('html2canvas/jsPDF жүктелмеген.');
    if (win && !win.closed) win.document.write('<p style="font:14px/1.4 sans-serif">Қате: PDF кітапханалары жүктелмеген.</p>');
    return;
  }

  // DOM -> PDF Blob (локалға сақтамаймыз!)
  const pdf = await makePdfFromDom('#screen-result', { margin: 10 });
  const pdfBlob = pdf.output('blob');

  // Drive-қа жіберу (CORS-сыз)
  const latestUrl = GAS_ENDPOINT
    + '?latest=1&secret=' + encodeURIComponent(GAS_SECRET)
    + '&user=' + encodeURIComponent(meta.user || expert);

  try {
    await uploadPdfToDrive(pdfBlob, meta, fileName);
    // Кішкене кідіріс: latest индексі жазылып үлгерсін
    setTimeout(()=>{
      if (win && !win.closed) win.location.href = latestUrl;
      else window.open(latestUrl, '_blank', 'noopener');
    }, 400);
  } catch (err) {
    console.error('Drive upload error:', err);
    if (win && !win.closed) {
      win.document.write('<p style="font:14px/1.4 sans-serif">Drive-қа жүктеу сәтсіз. Кейінірек қайталап көріңіз.</p>');
    } else {
      alert('Drive-қа жүктеу сәтсіз. Кейінірек қайталап көріңіз.');
    }
  }
}

// --- Persistence --------------------------------------------------------
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({ current, answers, useTimer })); }catch{} }
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if(!s) return;
    useTimer=!!s.useTimer; const tgl=$('#timerToggle'); if(tgl) tgl.checked=useTimer;
    current=Math.min(Math.max(Number(s.current)||0,0), QUESTIONS.length-1);
    if(Array.isArray(s.answers)) s.answers.forEach((v,i)=> answers[i]=(v===null?null:Number(v)));
  }catch{}
}

// --- Events -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  on('#btnStart','click',()=>{
    const tgl=$('#timerToggle'); useTimer=!!(tgl && tgl.checked);
    const name=$('#expertName')?.value?.trim();
    if(name){ window.__who=window.__who||{}; window.__who.name=name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });

  on('#btnNext','click',()=>{
    if (answers[current] == null) {
      const pill=$('#qHint'); const old=pill?.textContent||'';
      if (pill){ pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>{ pill.textContent=old; },1200); }
      return;
    }
    move(1);
  });

  on('#btnBack','click',()=> move(-1));
  // Талап бойынша "Skip" жоқ болса — мына жолды алып тастауға болады
  on('#btnSkip','click',()=>{ answers[current]=null; move(1); });

  on('#btnRestart','click',()=>{ answers.fill(null); localStorage.removeItem(LS_KEY); location.reload(); });
  on('#btnReview','click',()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnExport','click', exportPDF);

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    const key=e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx=Number(key)-1; answers[current]=idx; saveState(); renderQuestion();
      if(useTimer) setTimeout(()=>move(1),120); // тек таймер қосулы болса ғана
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft') move(-1);
  });

  document.addEventListener('visibilitychange',()=>{ if(!useTimer) return; if(document.hidden) stopTimer(); else startTimer(PER_QUESTION,()=>move(1)); });
});
