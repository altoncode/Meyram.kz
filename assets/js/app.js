// Meyram Quiz — app.js (JSONP + same-tab HTML print)
'use strict';

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwMZEMNzhnGAXw6MQXIiNZph32E0eiOXlrvl8N9BAFa4XuPbVRZy9-t4fQiR0ST5Rl9/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

const DOMAINS = {
  TH:{ name:'Мышление (Стратегиялық ойлау)', color:'#86ffda', desc:'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB:{ name:'Отношения (Қарым-қатынас)',      color:'#6ea8fe', desc:'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
  EX:{ name:'Достигаторство (Орындау)',       color:'#c8a5ff', desc:'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN:{ name:'Влияние (Әсер ету)',             color:'#ffd28a', desc:'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' }
};

const QUESTIONS = [
  { t:'Маған ойлануға, жалғыз отырып жоспар құруға уақыт қажет.', d:'TH' },
  { t:'Жаңа идеялар ойлап табу мені шабыттандырады.', d:'TH' },
  { t:'Ақпаратты терең талдауды ұнатамын.', d:'TH' },
  { t:'Күрделі мәселелерді шешкенде өзімді мықты сезінемін.', d:'TH' },
  { t:'Болашақ туралы стратегия құру маған қуат береді.', d:'TH' },
  { t:'Мен адамдарды біріктіріп, жылы атмосфера жасағанды жақсы көремін.', d:'RB' },
  { t:'Командадағы достық маған нәтижеден де маңызды.', d:'RB' },
  { t:'Адамдардың сезінін тез түсінемін.', d:'RB' },
  { t:'Біреуге қолдау көрсеткенде өзімді бақытты сезінемін.', d:'RB' },
  { t:'Қарым-қатынаста сенім – мен үшін ең бастысы.', d:'RB' },
  { t:'Жоспар құрсам, міндетті түрде соңына дейін жеткіземін.', d:'EX' },
  { t:'Маған нақты тапсырма мен дедлайн берілсе, жақсы жұмыс істеймін.', d:'EX' },
  { t:'Тәртіп пен жүйелілік маған күш береді.', d:'EX' },
  { t:'Бір күнді бос өткізсем, өзімді жайсыз сезінемін.', d:'EX' },
  { t:'Мақсатқа жету жолында кедергілерден қаймықпаймын.', d:'EX' },
  { t:'Көпшілік алдында сөйлегенді ұнатамын.', d:'IN' },
  { t:'Басқаларды сендіріп, өз идеяма тарту қолымнан келеді.', d:'IN' },
  { t:'Командада көшбасшы болу маған табиғи көрінеді.', d:'IN' },
  { t:'Таныс емес адамдармен тез тіл табысамын.', d:'IN' },
  { t:'Жаңа бастаманы бастауға өзгелерді ерте аламын.', d:'IN' }
];

/* ====================== State ====================== */
const Q_LEN = QUESTIONS.length;
let current = 0;
const answers = new Array(Q_LEN).fill(null);

let useTimer = false, timerId = null;
const PER_Q = 20;

let LAST_PDF = null;      // { ok, fileId, fileUrl, name }
let CREATE_PROMISE = null;
let BUSY = false;         // UI guard

/* ====================== DOM utils ====================== */
const $ = s => document.querySelector(s);
function on(sel, ev, fn){ const el=$(sel); if(el) el.addEventListener(ev, fn); }
function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}
function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  return (s || 'Маман').slice(0,80);
}
function isAnswered(v){ return Number.isInteger(v) && v>=0 && v<=4; }
function isComplete(){ return answers.length===Q_LEN && answers.every(isAnswered); }

function setButtonsEnabled(flag){
  const e=$('#btnExport'), s=$('#btnSend');
  if (e) e.disabled = !flag || BUSY;
  if (s) s.disabled = BUSY; // SEND әрқашан қолжетімді (Drive-ты ішінде өзі жасайды)
}
function updateButtons(){
  const onResult = !$('#screen-result')?.classList.contains('hidden');
  if (onResult){
    // Export — нәтижеде әрқашан қолжетімді. Send — BUSY болмаса қолжетімді.
    setButtonsEnabled(true);
  } else {
    setButtonsEnabled(false);
  }
}

/* ====================== JSONP ====================== */
function uid(){ return Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2); }
function jsonp(url, timeoutMs=15000){
  return new Promise((resolve)=>{
    const cb='__CB_'+uid();
    let done=false, to=null;
    function finish(data){ if(done) return; done=true; clearTimeout(to); try{ delete window[cb]; }catch{}; resolve(data); }
    window[cb] = (data)=> finish(data);

    const sc=document.createElement('script');
    sc.src = url + (url.includes('?')?'&':'?') + 'callback=' + cb; // server safeCbName_ қолдайды
    sc.async = true;
    sc.onerror = ()=> finish({ ok:false, error:'Network' });
    sc.onload  = ()=> { try{ sc.remove(); } catch(_){} };
    document.head.appendChild(sc);

    to = setTimeout(()=> finish({ ok:false, error:'Timeout' }), timeoutMs);
  });
}

function answersCsv(){
  // null → -1 (сервер есептен тыс қылады)
  return answers.map(v => (isAnswered(v) ? v : -1)).join(',');
}

function buildCreateUrl(expert){
  const qs = [
    'mode=create',
    'secret=' + encodeURIComponent(GAS_SECRET),
    'expert=' + encodeURIComponent(expert),
    'answers=' + encodeURIComponent(answersCsv())
  ].join('&');
  return `${GAS_ENDPOINT}?${qs}`;
}
function buildPrintUrl(expert){
  const qs = [
    'mode=print',
    'secret=' + encodeURIComponent(GAS_SECRET),
    'expert=' + encodeURIComponent(expert),
    'answers=' + encodeURIComponent(answersCsv())
  ].join('&');
  return `${GAS_ENDPOINT}?${qs}`;
}
window.buildPrintUrl = buildPrintUrl;

/* ====================== Quiz UI ====================== */
function renderQuestion(){
  const q = QUESTIONS[current];
  if (!q) return;

  const qText = $('#qText'); if (qText) qText.textContent = q.t;
  const qCounter = $('#qCounter'); if (qCounter) qCounter.textContent = `Сұрақ ${current+1} / ${Q_LEN}`;

  const done = answers.filter(isAnswered).length;
  const prog = $('#progress'); if (prog) prog.style.width = Math.round(done/Q_LEN*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); if (scale) {
    scale.innerHTML='';
    labels.forEach((lab, idx)=>{
      const btn = document.createElement('button');
      btn.type='button';
      btn.className='opt';
      btn.textContent = lab;
      btn.style.setProperty('color', '#fff', 'important'); // ақ мәтін
      if (answers[current]===idx) btn.classList.add('active');
      btn.addEventListener('click', ()=>{
        answers[current]=idx;
        renderQuestion();
        if (useTimer) setTimeout(()=>move(1), 120);
      });
      scale.appendChild(btn);
    });
  }

  const pill = $('#timerPill');
  if (pill) pill.style.display = useTimer ? 'inline-flex' : 'none';
  if (useTimer) startTimer(PER_Q, ()=>move(1)); else stopTimer();

  const back = $('#btnBack'); if (back) back.disabled = (current===0);
}

function move(d){
  stopTimer();
  current += d;
  if (current<0) current=0;
  if (current>=Q_LEN){ finishQuiz(); return; }
  renderQuestion();
}

function startTimer(sec, onDone){
  let left=sec; const tEl=$('#timer'); if (tEl) tEl.textContent=left;
  timerId=setInterval(()=>{
    left--;
    if (tEl) tEl.textContent=left;
    if(left<=0){ stopTimer(); onDone&&onDone(); }
  },1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

/* ====================== Compute ====================== */
function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]};
  QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const k of Object.keys(per)){
    const arr=per[k].filter(v=> isAnswered(v));  // ❗️-1/NULL есептен тыс
    const sum=arr.reduce((a,b)=>a+Number(b),0);
    const denom=Math.max(arr.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max=Math.max(...Object.values(raw));
  const top = max>0 ? Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k) : [];
  return { raw, norm, top };
}

/* ====================== Result render ====================== */
function showWaiting(){
  show('#screen-result');
  const eD=$('#expertDisplay'); if (eD) eD.textContent='';
  const tt=$('#topTitle'); if (tt) tt.textContent='Нәтижеңіз дайындалуда…';
  const td=$('#topDesc'); if (td) td.textContent ='Кішкене күтіңіз. Нәтиже дайын болған соң PDF ретінде сақтай аласыз немесе сілтемемен бөлісе аласыз.';
  const bars=$('#bars'); if (bars) bars.innerHTML='';
  const ex=$('#explain'); if (ex) ex.innerHTML='';
  setButtonsEnabled(false);
}

function renderResultContent(){
  const { norm, top } = compute();
  const name = $('#expertName')?.value?.trim() || '';
  const eD=$('#expertDisplay'); if (eD) eD.textContent = name ? `Маман: ${name}` : '';

  const topNames = top.length ? top.map(k=>DOMAINS[k].name).join(' + ') : '—';
  const tt=$('#topTitle'); if (tt) tt.textContent = `Басым домен: ${topNames}`;
  const td=$('#topDesc'); if (td) td.textContent  = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || 'Қысқаша нәтижелер төменде.');

  const prog=$('#progress'); if (prog) prog.style.width='100%';

  const bars=$('#bars'); if (bars){
    bars.innerHTML='';
    ['TH','RB','EX','IN'].forEach(k=>{
      const row=document.createElement('div'); row.className='barrow';
      const lab=document.createElement('div'); lab.innerHTML=`<span class="badge">${k}</span> ${DOMAINS[k].name}`;
      const track=document.createElement('div'); track.className='bartrack';
      const fill=document.createElement('div'); fill.className='barfill';
      fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; fill.style.width='0%';
      const pct=document.createElement('div'); pct.textContent=(norm[k]||0)+'%'; pct.style.textAlign='right';
      track.appendChild(fill); row.append(lab,track,pct); bars.appendChild(row);
      requestAnimationFrame(()=>{ fill.style.width=(norm[k]||0)+'%'; });
    });
  }

  // Export енді дәл осы жерде ашылады (Drive күтпейміз)
  updateButtons();
}

/* ====================== Drive create ====================== */
async function ensurePdfCreated(){
  if (LAST_PDF && LAST_PDF.fileId) return LAST_PDF;
  if (CREATE_PROMISE) return CREATE_PROMISE;

  const expert = sanitizeFilename($('#expertName')?.value?.trim() || 'Маман');
  const url = buildCreateUrl(expert);

  CREATE_PROMISE = jsonp(url).then(resp=>{
    CREATE_PROMISE = null;
    if (resp && resp.ok && !resp.fileUrl && resp.fileId) {
      resp.fileUrl = 'https://drive.google.com/file/d/'+resp.fileId+'/view?usp=drivesdk';
    }
    LAST_PDF = (resp && resp.ok) ? resp : null;
    return LAST_PDF;
  });

  return CREATE_PROMISE;
}

/* ====================== Finish flow ====================== */
async function finishQuiz(){
  showWaiting();

  // Нәтижені бірден көрсетеміз (Export қолжетімді болады)
  renderResultContent();

  // Drive-қа сақтауды фондық түрде бастаймыз — дайын болғанда Send батырмасы "сілтемемен" бөліседі
  ensurePdfCreated().then(()=> updateButtons());
}

/* ====================== Export / Send ====================== */
async function onExportPdf(){
  // ❗️Export үшін Drive күтудің қажеті жоқ
  const expert = sanitizeFilename($('#expertName')?.value?.trim() || 'Маман');
  const printUrl = buildPrintUrl(expert); // сервер HTML шығарып, ішінде window.print()
  location.assign(printUrl);              // жаңа таб ашпай, осы бетте
}

async function onSendPdf(){
  if (BUSY) return;
  BUSY = true; updateButtons();

  try {
    const pdf = await ensurePdfCreated();
    if (!pdf || !pdf.fileUrl) throw new Error('PDF дайын емес. Кейін қайталап көріңіз.');
    const title='Meyram — домен-тест нәтижесі';
    const text ='Нәтиже PDF:'; const url = pdf.fileUrl;

    if (navigator.share) {
      try { await navigator.share({ title, text, url }); BUSY=false; updateButtons(); return; }
      catch(_) { /* түспей қалса — төмендегі fallback */ }
    }
    // WhatsApp/Clipboard т.б. қосқың келсе — осында
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    console.error(e);
    alert(e.message || 'Қате орын алды.');
  } finally {
    BUSY = false; updateButtons();
  }
}

/* ====================== Wiring ====================== */
function wireUi(){
  on('#btnStart','click', ()=>{
    useTimer = !!($('#timerToggle') && $('#timerToggle').checked);
    const name=$('#expertName')?.value?.trim(); if(name){ window.__who = window.__who || {}; window.__who.name = name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });
  on('#btnNext','click', ()=>{
    if (!isAnswered(answers[current])){
      const pill=$('#qHint'); if (pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>pill.textContent=old,1200); }
      return;
    }
    move(1);
  });
  on('#btnBack','click', ()=> move(-1));
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{ answers.fill(null); location.reload(); });

  on('#btnExport','click', onExportPdf);
  on('#btnSend'  ,'click', onSendPdf);

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    if (['1','2','3','4','5'].includes(e.key)){
      answers[current]=Number(e.key)-1; renderQuestion();
      if (useTimer) setTimeout(()=>move(1),120);
    }
    if (e.key==='ArrowRight') move(1);
    if (e.key==='ArrowLeft')  move(-1);
  });

  updateButtons();
}

document.addEventListener('DOMContentLoaded', wireUi);
