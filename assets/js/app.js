// assets/js/app.js — JSONP-only (server builds & shares PDF). No DOM->PDF.
'use strict';

/*** CONFIG ***/
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyw6tONB_fyKqoLj4v-J-7IOpWmsl_ucUXXo4V-RxSspp6YkHQOkvywb12CpYMyUhXc/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/*** DATA ***/
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
  { t:'Адамдардың сезімін тез түсінемін.', d:'RB' },
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

/*** STATE ***/
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null);
let useTimer = false, timerId = null;
const PER_Q = 20;
let LAST_PDF = null;        // {url,id,name}
let CREATE_PROMISE = null;  // in-flight guard

/*** HELPERS ***/
const $ = s => document.querySelector(s);
function on(sel, ev, fn){ const el=$(sel); if(el) el.addEventListener(ev, fn); }
function show(id){ ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden')); $(id)?.classList.remove('hidden'); }
function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  return (s || 'Маман').slice(0,80);
}
function uid(){ return Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2); }
function jsonp(url, timeoutMs=15000){
  return new Promise((resolve)=>{
    const cb='__CB_'+uid(); let done=false;
    const s=document.createElement('script');
    const finish = (data)=>{ if(done) return; done=true; try{ resolve(data); } finally{ delete window[cb]; try{s.remove();}catch{} } };
    window[cb] = (data)=> finish(data);
    s.src = url + (url.includes('?')?'&':'?') + 'callback=' + encodeURIComponent(cb);
    s.async = true; s.onerror = ()=> finish({ ok:false, error:'Network' });
    document.head.appendChild(s);
    setTimeout(()=> finish({ ok:false, error:'Timeout' }), timeoutMs);
  });
}
function buildCreateUrl(expert, answersArr){
  const csv = answersArr.map(v=> (v==null?-1:Number(v))).join(',');
  const qs = [
    'mode=create',
    'secret=' + encodeURIComponent(GAS_SECRET),
    'expert=' + encodeURIComponent(expert),
    'answers=' + encodeURIComponent(csv)
  ].join('&');
  return `${GAS_ENDPOINT}?${qs}`;
}

// 1) preview URL-ды минимал UI-мен берейік
function driveEmbedUrl(pdf){
  const id = pdf?.id || extractId(pdf?.url || '');
  if (!id) return null;
  // rm=minimal -> Drive UI азаяды (шрифттер аз жүктеледі)
  return `https://drive.google.com/file/d/${id}/preview?rm=minimal#view=FitH`;
}

// 2) принт функциясы сол күйі қалады (жасырын iframe арқылы)
function printViaHiddenIframe(url){
  const prev = document.getElementById('print-frame'); if (prev) try{prev.remove();}catch{}
  const f=document.createElement('iframe');
  f.id='print-frame';
  Object.assign(f.style,{position:'fixed',right:'0',bottom:'0',width:'0',height:'0',border:'0'});
  f.src = url;

  let fired=false;
  const go=()=>{ if(fired) return; fired=true;
    try{ f.contentWindow?.focus(); f.contentWindow?.print(); }catch{}
    setTimeout(()=>{ try{f.remove();}catch{} }, 1500);
  };

  // Негізгі – onload, қосымша – safety timeout
  f.onload=()=>setTimeout(go, 300);
  setTimeout(go, 8000);
  document.body.appendChild(f);
}
Ескерту:

Бұл “Slow network…” жазбаларын толық жоймайды (олар Drive-тың өз консольі), бірақ азайта алады. Функционалға әсер етпейді.

Негізгі тексеретін нәрсе — файлға “Anyone with the link → Viewer” рұқсаты берілгені. Оны GAS-та мына жолмен қосқаныңызға көз жеткізіңіз:

js
Копировать код
Drive.Permissions.create(
  {role:'reader', type:'anyone', allowFileDiscovery:false},
  fileId,
  {supportsAllDrives:true}
);
function driveShareUrl(pdf){
  // Пайдаланушыға жіберуге ыңғайлы view
  const id = pdf?.id || extractId(pdf?.url || '');
  if (!id) return pdf?.url || null;
  return `https://drive.google.com/file/d/${id}/view?usp=sharing`;
}
function extractId(url){
  if (!url) return null;
  let m = url.match(/\/file\/d\/([^/]+)/); if (m) return m[1];
  m = url.match(/[?&]id=([^&]+)/);        if (m) return m[1];
  m = url.match(/\/d\/([^/]+)\//);        if (m) return m[1];
  return null;
}

/*** QUIZ RENDER ***/
function renderQuestion(){
  stopTimer();
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const done = answers.filter(v=>v!=null).length;
  $('#progress').style.width = Math.round(done/QUESTIONS.length*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); scale.innerHTML='';

  labels.forEach((lab, idx)=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='opt';
    btn.textContent = lab;
    btn.style.color = '#fff'; // ақ мәтін
    if (answers[current]===idx) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      answers[current]=idx;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1),120);
    });
    scale.appendChild(btn);
  });

  $('#timerPill').style.display = useTimer ? 'inline-flex' : 'none';
  if (useTimer) startTimer(PER_Q, ()=>move(1));
  $('#btnBack').disabled = (current===0);
}
function move(d){
  stopTimer();
  current += d;
  if (current<0) current=0;
  if (current>=QUESTIONS.length){ finishQuiz(); return; }
  renderQuestion();
}
function startTimer(sec,onDone){
  let left=sec; $('#timer').textContent=left;
  timerId=setInterval(()=>{ left--; $('#timer').textContent=left; if(left<=0){ stopTimer(); onDone&&onDone(); } },1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]}; QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const k of Object.keys(per)){
    const arr=per[k].filter(v=>v!=null), sum=arr.reduce((a,b)=>a+Number(b),0), denom=Math.max(arr.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max=Math.max(...Object.values(raw));
  const top=Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k);
  return { raw, norm, top };
}

/*** RESULT FLOW ***/
function setPdfUiState(state){
  const be=$('#btnExport'), bs=$('#btnSend');
  if (be){ be.disabled=false; be.textContent = state==='ready' ? 'PDF ретінде сақтау' : 'PDF дайындалуда…'; }
  if (bs){ bs.disabled=false; bs.textContent = state==='ready' ? 'PDF жіберу (Drive)' : 'PDF дайындалуда…'; }
}
function showWaiting(){
  show('#screen-result');
  $('#expertDisplay').textContent = '';
  $('#topTitle').textContent = 'Нәтиже дайындалуда…';
  $('#topDesc').textContent  = 'PDF жасалып, Google Drive-қа сақталып жатыр.';
  $('#bars').innerHTML = '';
  $('#explain').innerHTML = '';
  setPdfUiState('pending');
}
function renderResultContent(){
  const { norm, top } = compute();
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';
  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent  = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || '');

  const bars=$('#bars'); bars.innerHTML='';
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

  const SUG={TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
             RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
             EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
             IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'};
  const ex=$('#explain'); ex.innerHTML='';
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML=`<div class="pill">${DOMAINS[k].name}</div>
                   <div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  setPdfUiState(LAST_PDF ? 'ready' : 'pending');
}
async function ensurePdfCreated(){
  if (LAST_PDF && LAST_PDF.url) return LAST_PDF;
  if (CREATE_PROMISE) return CREATE_PROMISE;

  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );
  const url = buildCreateUrl(expert, answers);
  CREATE_PROMISE = jsonp(url).then(resp=>{
    CREATE_PROMISE = null;
    if (resp && resp.ok) { LAST_PDF = { url: resp.fileUrl, id: resp.fileId, name: resp.name }; setPdfUiState('ready'); return LAST_PDF; }
    LAST_PDF = null; setPdfUiState('pending'); return null;
  });
  return CREATE_PROMISE;
}
async function finishQuiz(){
  showWaiting();
  LAST_PDF = null;
  await ensurePdfCreated();
  renderResultContent();
  $('#progress').style.width='100%';
}

/*** PRINT (no popup; Drive /preview to avoid 403) ***/
function printViaHiddenIframe(url){
  const prev = document.getElementById('print-frame'); if (prev) try{prev.remove();}catch{}
  const f=document.createElement('iframe');
  f.id='print-frame';
  Object.assign(f.style,{position:'fixed',right:'0',bottom:'0',width:'0',height:'0',border:'0'});
  f.src = url;
  let fired=false;
  const go=()=>{ if(fired) return; fired=true;
    try{ f.contentWindow?.focus(); f.contentWindow?.print(); }catch{}
    setTimeout(()=>{ try{f.remove();}catch{} }, 1500);
  };
  // onload — әдетте жеткілікті; safety timeout — 8s
  f.onload=()=>setTimeout(go,300);
  setTimeout(go,8000);
  document.body.appendChild(f);
}

/*** ACTIONS ***/
async function onExportPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.url){ alert('PDF дайындалуда. Бірер секундтан кейін қайталап көріңіз.'); return; }

  // /view → /preview (iframe friendly). Егер файл “anyone with link” емес болса, 403 болуы мүмкін.
  const embed = driveEmbedUrl(pdf);
  if (!embed){ window.open(pdf.url, '_blank', 'noopener'); return; }

  printViaHiddenIframe(embed);
}
async function onSendPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.url){ alert('PDF дайындалуда. Бірер секундтан кейін қайталап көріңіз.'); return; }
  const share = driveShareUrl(pdf);
  const title='Meyram — домен-тест нәтижесі', text='Нәтиже PDF:', url=share || pdf.url;
  if (navigator.share){ try{ await navigator.share({title, text, url}); return; }catch{} }
  window.open('https://wa.me/?text='+encodeURIComponent(`${title}\n${url}`),'_blank','noopener');
}

/*** UI glue ***/
function initUI(){
  // опциялар мәтінін ақ ету
  const style=document.createElement('style'); style.textContent='.scale .opt{color:#fff !important}'; document.head.appendChild(style);

  on('#btnStart','click', ()=>{
    useTimer = !!($('#timerToggle') && $('#timerToggle').checked);
    const name=$('#expertName')?.value?.trim(); if(name){ window.__who=window.__who||{}; window.__who.name=name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });
  on('#btnNext','click', ()=>{
    if (answers[current]==null){
      const pill=$('#qHint'); if(pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>pill.textContent=old,1100); }
      return;
    }
    move(1);
  });
  on('#btnBack','click', ()=> move(-1));
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{ answers.fill(null); location.reload(); });

  on('#btnExport','click', onExportPdf);
  on('#btnSend','click',   onSendPdf);

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    if (['1','2','3','4','5'].includes(e.key)){
      answers[current]=Number(e.key)-1; renderQuestion(); if(useTimer) setTimeout(()=>move(1),120);
    }
    if (e.key==='ArrowRight') move(1);
    if (e.key==='ArrowLeft')  move(-1);
  });

  document.addEventListener('visibilitychange', ()=>{ if(!useTimer) return; if(document.hidden) stopTimer(); else startTimer(PER_Q, ()=>move(1)); });
}

document.addEventListener('DOMContentLoaded', initUI);
