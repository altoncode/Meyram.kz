// Meyram Quiz — app.js (Drive JSONP polling edition)
'use strict';

// ===== GAS config (жаңа кілттеріңіз) =====
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzepRWbTlgTEF1bKABiFQbvTow3EHKIWcDUspquJ-3EzNeKCSYE9ZQja1PYW0pQMW0U/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

// ===== Quiz data =====
const DOMAINS = {
  TH:{ name:'Мышление (Стратегиялық ойлау)', desc:'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB:{ name:'Отношения (Қарым-қатынас)', desc:'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
  EX:{ name:'Достигаторство (Орындау)', desc:'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN:{ name:'Влияние (Әсер ету)', desc:'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' },
};
const QUESTIONS = [ /* ... сіздегі 20 сұрақтың массиві өзгеріссіз ... */ ];

let current = 0;
const answers = new Array(QUESTIONS.length).fill(null);
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20;
const LS_KEY = 'meyram-quiz-v1';

// ===== DOM helpers =====
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
function on(sel, ev, h){ const el=$(sel); if(el) el.addEventListener(ev,h); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

// ===== Utils =====
function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'');
  s = s.replace(/\s+/g,'_').replace(/_+/g,'_');
  s = s.replace(/^_+|_+$/g,'');
  if(!s) s='Маман';
  return s.slice(0,80);
}
function ymd(d=new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function uid(){
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

// ===== Quiz core (қысқаша) =====
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const done = answers.filter(v=>v!=null).length;
  $('#progress').style.width = Math.round(done/QUESTIONS.length*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); scale.innerHTML='';
  labels.forEach((lab, idx)=>{
    const opt = document.createElement('div'); opt.className='opt'; opt.tabIndex=0; opt.setAttribute('role','radio');
    const span = document.createElement('span'); span.textContent = lab;
    const input=document.createElement('input'); input.type='radio'; input.name=`q${current}`; input.value=String(idx); input.tabIndex=-1; input.style.pointerEvents='none';
    if(answers[current]===idx){ input.checked=true; opt.classList.add('active'); opt.setAttribute('aria-checked','true'); }
    input.addEventListener('change',()=>{
      answers[current]=idx;
      $$('.opt').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active'); opt.setAttribute('aria-checked','true');
      if(useTimer) setTimeout(()=>move(1),120);
    });
    opt.addEventListener('click',()=>input.click());
    opt.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); }});
    opt.append(span,input); scale.appendChild(opt);
  });

  if(useTimer){ $('#timerPill').style.display='inline-flex'; startTimer(PER_QUESTION,()=>move(1)); }
  else { $('#timerPill').style.display='none'; stopTimer(); }

  $('#btnBack').disabled = (current===0);
}
function move(d){
  stopTimer(); current+=d;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){ showResult(); return; }
  renderQuestion();
}
function startTimer(s,done){
  let left=s; $('#timer').textContent=left;
  timerId=setInterval(()=>{ left--; $('#timer').textContent=left; if(left<=0){ stopTimer(); done&&done(); }},1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
function compute(){
  const buckets={TH:[],RB:[],EX:[],IN:[]};
  QUESTIONS.forEach((q,i)=> buckets[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const [k,arr] of Object.entries(buckets)){
    const done = arr.filter(v=>v!=null);
    const sum = done.reduce((a,b)=>a+Number(b),0);
    const denom = Math.max(done.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max = Math.max(...Object.values(raw));
  const top = Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k);
  return { raw, norm, top };
}
function showResult(){
  const { norm, top } = compute();
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || '');

  // Бар графикасын керек болса өзіңізбен қалдырасыз.
  $('#bars').innerHTML='';

  show('#screen-result');
}

// ======= DRIVE: POST (no-cors) + JSONP polling =======
function postResultToServer(token, expert, norm, top, answersArr){
  const payload = {
    secret: GAS_SECRET,
    token,
    expert,
    baseName: `${expert}_${ymd(new Date())}`,
    norm,
    top,
    answers: answersArr.map(v => (v==null ? -1 : v)),
  };
  const bodyStr = JSON.stringify(payload);

  // sendBeacon (фон) → болмаса fetch(no-cors)
  if (navigator.sendBeacon){
    const ok = navigator.sendBeacon(GAS_ENDPOINT, new Blob([bodyStr], { type:'text/plain;charset=utf-8' }));
    if (ok) return;
  }
  // no-cors: жауап оқымаймыз, тек жібере саламыз
  fetch(GAS_ENDPOINT, {
    method:'POST', mode:'no-cors',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: bodyStr
  }).catch(()=>{ /* ignore */ });
}

// JSONP бір рет шақыру
function jsonp(url, cbName){
  return new Promise((resolve)=>{
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + encodeURIComponent(cbName);
    s.async = true;
    s.onerror = ()=> resolve(null);
    document.head.appendChild(s);
  });
}
// Поллинг: 1.5 сек сайын 60 секке дейін
function pollForFile(token, onReady, onPending, onTimeout){
  let stopped=false, tries=0, maxTries=40; // ~60 сек (1.5s * 40)
  (function tick(){
    if(stopped) return;
    const cbName = '__MEYRAM_CB_' + uid();
    window[cbName] = (data)=>{
      try{
        if (data && data.ok && data.fileUrl){
          stopped=true; delete window[cbName];
          onReady(data);
        } else {
          onPending && onPending(data);
          tries++;
          if(tries >= maxTries){
            stopped=true; delete window[cbName];
            onTimeout && onTimeout();
          } else {
            setTimeout(tick, 1500);
          }
        }
      } finally {
        // tag-ті тазалау
        const toRemove = document.querySelectorAll(`script[src*="${encodeURIComponent(cbName)}"]`);
        toRemove.forEach(n=> n.parentNode && n.parentNode.removeChild(n));
      }
    };
    const url = `${GAS_ENDPOINT}?mode=result&token=${encodeURIComponent(token)}`;
    jsonp(url, cbName);
  })();
}

// ===== Button handlers =====
function sendToDrive(){
  // UI
  const btn = $('#btnSend'); const a = $('#driveLink');
  btn && (btn.disabled = true);
  if (a){
    a.removeAttribute('href');
    a.textContent = 'Жүктеліп жатыр… (Drive)';
  }

  // Data
  const exp = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent||'').replace(/^Маман:\s*/,'') ||
    'Маман'
  );
  const { norm, top } = compute();
  const token = uid();

  // Жіберу
  postResultToServer(token, exp, norm, top, answers);

  // Поллинг
  pollForFile(
    token,
    // onReady
    (data)=>{
      if(a){
        a.href = data.fileUrl;
        a.textContent = 'Drive сілтеме: ашу';
        a.style.display = 'inline';
      }
      btn && (btn.disabled = false);
    },
    // onPending
    ()=>{
      if(a) a.textContent = 'Дайындалуда…';
    },
    // onTimeout
    ()=>{
      if(a){
        a.removeAttribute('href');
        a.textContent = 'Сілтеме дайын емес. Кейінірек көріңіз.';
      }
      btn && (btn.disabled = false);
    }
  );
}

// ===== Wiring =====
document.addEventListener('DOMContentLoaded', ()=>{
  // Старт
  on('#btnStart','click', ()=>{
    const tgl=$('#timerToggle'); useTimer=!!(tgl && tgl.checked);
    const name=$('#expertName')?.value?.trim();
    if(name){ window.__who=window.__who||{}; window.__who.name=name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });

  on('#btnNext','click', ()=>{
    if(answers[current]==null){
      const pill=$('#qHint'); if(pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>{ pill.textContent=old; },1200); }
      return;
    }
    move(1);
  });
  on('#btnBack','click', ()=> move(-1));
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{ answers.fill(null); localStorage.removeItem(LS_KEY); location.reload(); });

  // Міне — жөнделген «PDF жіберу (Drive)»
  on('#btnSend','click', sendToDrive);

  // Қысқа пернелер
  document.addEventListener('keydown', (e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    if(['1','2','3','4','5'].includes(e.key)){
      answers[current]=Number(e.key)-1; renderQuestion();
      if(useTimer) setTimeout(()=>move(1),120);
    }
    if(e.key==='ArrowRight') move(1);
    if(e.key==='ArrowLeft')  move(-1);
  });
});
