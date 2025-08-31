// Meyram Quiz — app.js
// TZ: Asia/Almaty (UTC+5)
'use strict';

// === Google Apps Script конфиг ======================
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwhpToU1iOp2yQ625DF1zdaJb5uUROaTRFGATWAOQZHjT4o3rmLkQ-K0JpcUxbYXSDg/exec';
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
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function on(sel, ev, handler){ const el=$(sel); if(el) el.addEventListener(ev, handler); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

// Кирилл атауын файл ішінде көрсетуге болады; тек шын тыйым салынғанын аламыз
function sanitizeFilename(name){
  let s = String(name || '').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g, ''); // forbidden
  s = s.replace(/\s+/g, '_').replace(/_+/g, '_');      // space -> _
  s = s.replace(/^_+|_+$/g, '');                       // trim _
  if (!s) s = 'Маман';
  return s.slice(0, 80);
}
function formatDateYMD(d=new Date()){
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// --- Quiz rendering -----------------------------------------------------
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const answeredCount = answers.filter(v => v != null).length;
  $('#progress').style.width = Math.round((answeredCount/QUESTIONS.length)*100) + '%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); 
  scale.innerHTML=''; 
  scale.setAttribute('role','radiogroup'); 
  scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx) => {
    const opt = document.createElement('div'); 
    opt.className='opt'; 
    opt.setAttribute('role','radio'); 
    opt.setAttribute('aria-checked', answers[current]===idx?'true':'false'); 
    opt.tabIndex=0;

    const text=document.createElement('span'); 
    text.textContent=lab;

    const input=document.createElement('input'); 
    input.type='radio'; 
    input.name=`q${current}`; 
    input.value=String(idx); 
    input.tabIndex=-1; 
    input.style.pointerEvents='none';

    if(answers[current]===idx){ 
      input.checked=true; 
      opt.classList.add('active'); 
    }

    input.addEventListener('change',()=>{
      answers[current]=idx;
      $$('.opt').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active'); 
      opt.setAttribute('aria-checked','true');
      saveState();
      if(useTimer) setTimeout(()=>move(1),120); // автокөшу тек таймер қосулыда
    });

    opt.addEventListener('click',()=>input.click());
    opt.addEventListener('keydown',(e)=>{
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); }
    });

    opt.append(text,input); 
    scale.appendChild(opt);
  });

  if(useTimer){ 
    $('#timerPill').style.display='inline-flex'; 
    startTimer(PER_QUESTION,()=>move(1)); 
  } else { 
    $('#timerPill').style.display='none'; 
    stopTimer(); 
  }

  $('#btnBack').disabled = (current===0);
}

function move(delta){
  stopTimer(); 
  current += delta;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){ showResult(); return; }
  saveState(); 
  renderQuestion();
}

function startTimer(sec,onDone){
  let left=sec; 
  $('#timer').textContent=left;
  timerId=setInterval(()=>{
    left--; 
    $('#timer').textContent=left; 
    if(left<=0){ stopTimer(); onDone&&onDone(); } 
  },1000);
}
function stopTimer(){ 
  if(timerId){ clearInterval(timerId); timerId=null; } 
}

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]}; 
  QUESTIONS.forEach((q,i)=>per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const [k,arr] of Object.entries(per)){ 
    const answered=arr.filter(v=>v!=null); 
    const sum=answered.reduce((a,b)=>a+Number(b),0); 
    const denom=Math.max(answered.length*4,1); 
    raw[k]=sum; 
    norm[k]=Math.round((sum/denom)*100); 
  }
  const maxRaw=Math.max(...Object.values(raw)); 
  const top=Object.entries(raw).filter(([,v])=>v===maxRaw).map(([k])=>k);
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

  const bars=$('#bars'); 
  bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row=document.createElement('div'); 
    row.className='barrow';
    const lab=document.createElement('div'); 
    lab.innerHTML=`<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track=document.createElement('div'); 
    track.className='bartrack';
    const fill=document.createElement('div'); 
    fill.className='barfill'; 
    fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; 
    fill.style.width='0%';
    const pct=document.createElement('div'); 
    pct.textContent=norm[k]+'%'; 
    pct.style.textAlign='right';
    track.appendChild(fill); 
    row.append(lab,track,pct); 
    bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width=norm[k]+'%'; });
  });

  const ex=$('#explain'); 
  ex.innerHTML='';
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

  show('#screen-result'); 
  saveState();
}

// === ТЕЗ РЕЖИМ: Печать бірден; PDF-ті сервердің өзі жинайды =============

// Нәтижені серверге жіберу (DOM-сыз, JSON-only)
function sendResultToServer() {
  const { norm, top } = compute();
  const expertRaw =
    $('#expertName')?.value?.trim() ||
    (window.__who && window.__who.name) ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман';

  const topTitle = top.map(k => DOMAINS[k].name).join(' + ');
  const payload = {
    result: {
      expert: expertRaw,
      scores: norm,      // {TH,RB,EX,IN}
      top,               // ['TH', ...]
      topTitle,
      generatedAt: new Date().toISOString()
    }
  };

  const url = GAS_ENDPOINT + '?secret=' + encodeURIComponent(GAS_SECRET);
  const bodyStr = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([bodyStr], { type:'application/json' }));
  } else {
    // CORS-пен әуре болмаймыз: жауап күтпейміз
    fetch(url, {
      method: 'POST',
      mode:   'no-cors',
      headers:{ 'Content-Type':'application/json' },
      body:   bodyStr
    }).catch(()=>{});
  }
}

// Печатьты лезде ашу, ал жіберуді артынан фонмен орындау
function exportPDF() {
  // 1) Печат диалогы — бірден
  try { window.print(); } catch(_) {}

  // 2) Кей браузерлер print кезінде JS-ті тоқтатады, сондықтан afterprint + таймер
  const doSend = () => sendResultToServer();
  if ('onafterprint' in window) {
    const handler = () => { window.removeEventListener('afterprint', handler); doSend(); };
    window.addEventListener('afterprint', handler);
  }
  // Фолбэк: егер afterprint келмесе — кішкене кешіктіріп жібереміз
  setTimeout(doSend, 150);
}

// Соңғы файлды Anyone with the link етіп шарингке қою
function sharePdf() {
  const expertRaw =
    $('#expertName')?.value?.trim() ||
    (window.__who && window.__who.name) ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман';

  const d = new Date();
  const dateYMD = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const payload = { action:'share', expert: expertRaw, date: dateYMD };
  const url = GAS_ENDPOINT + '?secret=' + encodeURIComponent(GAS_SECRET);
  const bodyStr = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([bodyStr], { type:'application/json' }));
  } else {
    fetch(url, {
      method: 'POST',
      mode:   'no-cors',
      headers:{ 'Content-Type':'application/json' },
      body:   bodyStr
    }).catch(()=>{});
  }

  // Жылдам UX-хабарлама (реал-тайм жауап күтпейміз)
  try { alert('PDF сілтемесі ашық етілді. Drive-та көре аласыз.'); } catch(_){}
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
  on('#btnSkip','click',()=>{ answers[current]=null; move(1); });

  on('#btnRestart','click',()=>{ answers.fill(null); localStorage.removeItem(LS_KEY); location.reload(); });
  on('#btnReview','click',()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnExport','click', exportPDF);
  on('#btnShare','click',  sharePdf);  // HTML-де осы ID бар болса, жұмыс істейді

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    const key=e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx=Number(key)-1; answers[current]=idx; saveState(); renderQuestion();
      if(useTimer) setTimeout(()=>move(1),120); // тек таймер қосулы болса ғана
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft')  move(-1);
  });

  document.addEventListener('visibilitychange',()=>{ 
    if(!useTimer) return; 
    if(document.hidden) stopTimer(); else startTimer(PER_QUESTION,()=>move(1)); 
  });
});
