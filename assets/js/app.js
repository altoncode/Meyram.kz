// Meyram Quiz — app.js (DOM-сыз Drive upload; JSONP арқылы сілтеме алу)
// TZ: Asia/Almaty (UTC+5)
'use strict';

/* ================== CONFIG ================== */
// ЖАҢА Web App ID (сіз берген)
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxsGmqu_3mzMrUdssGmuO-u2nMEo15HY_UK-eUtFCY2xEaJEYYPxN2K1V19BK650hGZ/exec';
// Shared secret (сервердегісімен дәл бірдей болуы керек)
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/* ================== QUIZ DATA ================== */
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

/* ================== STATE ================== */
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skipped
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20; // seconds
const LS_KEY = 'meyram-quiz-v1';

/* ================== HELPERS ================== */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function on(sel, ev, handler){ const el=$(sel); if(el) el.addEventListener(ev, handler); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

function sanitizeFilename(name){
  // Кириллді қалдырамыз, тек рұқсат етілмейтіндерін өшіреміз
  let s = String(name || '').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g, ''); // forbidden
  s = s.replace(/\s+/g, '_').replace(/_+/g, '_');      // space -> _
  s = s.replace(/^_+|_+$/g, '');
  if (!s) s = 'Маман';
  return s.slice(0, 80);
}
function ymd(d=new Date()){
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function uuid(){
  return (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)).toUpperCase();
}

/* ================== QUIZ CORE ================== */
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent     = q.t;
  $('#qCounter').textContent  = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const answeredCount = answers.filter(v => v != null).length;
  $('#progress').style.width  = Math.round((answeredCount/QUESTIONS.length)*100) + '%';

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
      if(useTimer) setTimeout(()=>move(1),120); // автокөшу тек таймер қосулыда
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
  for(const [k,arr] of Object.entries(per)){
    const answered=arr.filter(v=>v!=null);
    const sum=answered.reduce((a,b)=>a+Number(b),0);
    const denom=Math.max(answered.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
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
  $('#topDesc').textContent  = top.length>1
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

/* ================== PRINT (жылдам) ================== */
function exportPDF() {
  try { window.print(); } catch(_) {}
}

/* ================== JSONP UTILS ================== */
const __JSONP = { seq: 0 };
function jsonp(url, onOK, onFail, timeoutMs=8000){
  const cbName = '__M_CB_' + (++__JSONP.seq);
  const cleanup = ()=>{
    try{ delete window[cbName]; }catch{}
    if(script && script.parentNode) script.parentNode.removeChild(script);
    if(timer){ clearTimeout(timer); }
  };
  const script = document.createElement('script');
  const sep    = url.includes('?') ? '&' : '?';
  script.src   = `${url}${sep}callback=${cbName}&_=${Date.now()}`;

  let called = false;
  window[cbName] = (data)=>{
    if(called) return;
    called = true; cleanup();
    onOK && onOK(data);
  };

  script.onerror = ()=>{
    cleanup();
    onFail && onFail(new Error('JSONP network error'));
  };
  const timer = setTimeout(()=>{
    cleanup();
    onFail && onFail(new Error('JSONP timeout'));
  }, timeoutMs);

  document.head.appendChild(script);
}

/* ================== SEND TO DRIVE (NO DOM PDF) ================== */
// Сервер PDF-ті өзі құрастырады (Google Doc -> PDF), реттік нөмірді де өзі қояды
async function sendToDrive(){
  const { norm, top } = compute();

  // Маман аты
  let expert = $('#expertName')?.value?.trim() || (window.__who&&window.__who.name) || 'Маман';
  const baseName = sanitizeFilename(expert) + '_' + ymd(new Date()); // сервер (1), (2) қосады

  // Payload — тек деректер (DOM сурет емес!)
  const token = uuid();
  const payload = {
    secret: GAS_SECRET,
    token,
    mode: 'create',          // серверге түсінікті болу үшін
    baseName,                // реттік нөмір серверде қосылады
    expert,
    norm,                    // {TH,RB,EX,IN}: %
    top,                     // басым домен кілттері
    answers,                 // толық жауаптар (қаласаңыз)
    generatedAt: new Date().toISOString()
  };

  // CORS ұстамау үшін — text/plain және no-cors/beacon
  const url = GAS_ENDPOINT;
  const body = JSON.stringify(payload);

  // sendBeacon негізгі опция
  let sent = false;
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(url, new Blob([body], { type:'text/plain;charset=utf-8' }));
    sent = ok;
  }
  if (!sent) {
    // fallback
    try {
      await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body });
      sent = true;
    } catch(_) { /* жұтамыз */ }
  }

  // UI: «Жіберілді…» статусы
  let linkEl = $('#driveLink');
  if (!linkEl) {
    linkEl = document.createElement('a');
    linkEl.id = 'driveLink';
    linkEl.target = '_blank';
    linkEl.rel = 'noopener';
    linkEl.style.marginLeft = '8px';
    // «PDF ретінде сақтау» батырмасының қасына қыстырамыз
    const btnRow = $('#btnExport')?.parentElement;
    if (btnRow) btnRow.appendChild(linkEl);
  }
  linkEl.textContent = 'Жіберілуде…';
  linkEl.removeAttribute('href');

  // Сервер PDF жасап болғаннан кейін — JSONP арқылы share-сілтемені алып, UI-ға шығарамыз
  // (серверде /exec?mode=result&token=... JSONP қайтаруы керек)
  const pollOnce = (triesLeft)=>{
    jsonp(`${GAS_ENDPOINT}?mode=result&token=${encodeURIComponent(token)}`,
      (data)=>{
        if (data && data.ok && data.fileUrl && data.name) {
          linkEl.textContent = `Drive: ${data.name}`;
          linkEl.href = data.fileUrl;   // басқаларға жіберуге болады
        } else {
          if (triesLeft > 0) setTimeout(()=>pollOnce(triesLeft-1), 900);
          else linkEl.textContent = 'Сілтеме дайын емес. Кейінірек көріңіз.';
        }
      },
      ()=>{
        if (triesLeft > 0) setTimeout(()=>pollOnce(triesLeft-1), 900);
        else linkEl.textContent = 'Сілтеме алынбады. Кейінірек көріңіз.';
      },
      4000
    );
  };
  // 10 ретке дейін, ~9–12 секундқа дейін поллимыз (сервер PDF құрастыруға үлгереді)
  pollOnce(10);
}

/* ================== PERSIST ================== */
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({ current, answers, useTimer })); }catch{} }
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if(!s) return;
    useTimer=!!s.useTimer; const tgl=$('#timerToggle'); if(tgl) tgl.checked=useTimer;
    current=Math.min(Math.max(Number(s.current)||0,0), QUESTIONS.length-1);
    if(Array.isArray(s.answers)) s.answers.forEach((v,i)=> answers[i]=(v===null?null:Number(v)));
  }catch{}
}

/* ================== EVENTS (берік байлау) ================== */
function bindOnce(el, ev, handler, mark='__bound'){ if(!el||el[mark]) return false; el.addEventListener(ev,handler); el[mark]=true; return true; }
function handleStartClick(){
  const tgl=$('#timerToggle'); useTimer=!!(tgl && tgl.checked);
  const name=$('#expertName')?.value?.trim();
  if(name){ window.__who=window.__who||{}; window.__who.name=name; }
  current=0; show('#screen-quiz'); renderQuestion();
}
function waitAndBindStart(retries=50){
  const ok = bindOnce($('#btnStart'),'click',handleStartClick);
  if(ok || retries<=0) return;
  setTimeout(()=>waitAndBindStart(retries-1),100);
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  waitAndBindStart();

  bindOnce($('#btnNext'),'click',()=>{
    if (answers[current] == null) {
      const pill=$('#qHint'); const old=pill?.textContent||'';
      if(pill){ pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>{ pill.textContent=old; },1200); }
      return;
    }
    move(1);
  });
  bindOnce($('#btnBack'),'click',()=> move(-1));
  bindOnce($('#btnSkip'),'click',()=>{ answers[current]=null; move(1); });
  bindOnce($('#btnRestart'),'click',()=>{ answers.fill(null); localStorage.removeItem(LS_KEY); location.reload(); });
  bindOnce($('#btnReview'),'click',()=>{ show('#screen-quiz'); renderQuestion(); });

  // PDF ретінде сақтау (тек print, DOM-сыз Drive-қа қатысы жоқ)
  bindOnce($('#btnExport'),'click', exportPDF);

  // PDF жіберу (сервер PDF жасайды; сілтемені JSONP-пен аламыз)
  // index.html ішінде осы батырма бар екеніне көз жеткізіңіз: <button class="btn primary" id="btnSend">PDF жіберу</button>
  bindOnce($('#btnSend'),'click', sendToDrive);

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    const key=e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx=Number(key)-1; answers[current]=idx; saveState(); renderQuestion();
      if(useTimer) setTimeout(()=>move(1),120);
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft')  move(-1);
  });

  document.addEventListener('visibilitychange',()=>{ if(!useTimer) return; if(document.hidden) stopTimer(); else startTimer(PER_QUESTION,()=>move(1)); });
});

// Соңғы делегация — #btnStart бәрібір жүрсін
document.addEventListener('click',(e)=>{
  const st=e.target.closest?.('#btnStart'); if(st && !st.__bound) handleStartClick();
});
