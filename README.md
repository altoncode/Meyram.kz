# Meyram Quiz (20 сұрақ) — Статикалық сайт

Бұл репо — сіз берген HTML/JS/CSS кодынан жиналған *deploy-ready* нұсқа. Фикстер:
- Артық `}` және артық `</div>` түзетілді
- `Skip` енді ұпай бұрмаламайды (есептен шығару)
- `compute()` домендер бойынша *жауап берілген* сұрақтармен нормализация жасайды
- a11y (aria-live, radiogroup), print-friendly стильдер, reduced-motion
- Қарапайым `localStorage` персист

## Құрылым
```
meyram-quiz-site/
  index.html
  assets/
    css/styles.css
    js/app.js
    img/favicon.svg
  robots.txt
```

## Жергілікті ашу
Бір файл `index.html`-ды браузермен ашсаңыз жеткілікті. Бірақ кейбір хостингтерде абсолюттік жол (`/assets/...`) қиындық тудырса, `index.html` ішіндегі `<link>` және `<script>` жолдарын салыстырмалыға (`assets/...`) ауыстырыңыз.

## Deploy нұсқалары

### Vercel
1. Жаңа жобаны импорттаңыз (Git-ке итеріп немесе zip аплоуд)
2. Framework = **Other**, Build Command жоқ
3. Output: root
4. Custom Domain бекітіп, кешті өшіріп тексеріңіз

### Netlify (Drag & Drop)
1. Netlify → Sites → Deploy manually
2. `meyram-quiz-site` папканы сүйреп тастаңыз
3. Custom Domain → DNS setup

### GitHub Pages
1. Репоға жүктеңіз
2. Settings → Pages → `main` / root
3. Сілтеме дайын болады

### Nginx (Linux)
```
server {
  listen 80;
  server_name quiz.meyram.kz;
  root /var/www/meyram-quiz-site;
  index index.html;
  location / { try_files $uri $uri/ =404; }
}
```

## Келесі қадамдар
- i18n (kk/ru) JSON арқылы
- Нәтижені PDF-ке әдемі шаблонмен шығару
- Admin-панельге JSON экспорт/вебхук
- PWA (offline) + manifest
