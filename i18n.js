const TRANSLATIONS = {
  en: {
    subtitle: "Polycyclic Aromatic Block Puzzle",
    score: "Score", best: "Best", level: "Level",
    "home.tagline": "Fused-ring molecules, hex by hex. Pick a way to play.",
    "home.fallingTitle": "Falling",
    "home.fallingDesc": "Molecules fall like Tetris — steer, rotate, and clear full rows before they stack up.",
    "home.placingTitle": "Placing",
    "home.placingDesc": "No rush — pick a molecule from the tray and fit it onto the board anywhere it goes.",
    "lang.label": "Language",
    "orientation.tagline": "Which way should the hexagons point?",
    "orientation.flatTitle": "Flat-top",
    "orientation.flatDesc": "Falls in a perfectly straight column; side-to-side moves drift slightly.",
    "orientation.pointyTitle": "Pointy-top",
    "orientation.pointyDesc": "Side-to-side moves are perfectly straight; the fall drifts slightly.",
    "difficulty.tagline": "How complex should the molecules get?",
    "difficulty.easyTitle": "Easy",
    "difficulty.easyDesc": "Mostly benzene and naphthalene, a few bigger ones.",
    "difficulty.normalTitle": "Normal",
    "difficulty.normalDesc": "A balanced mix across the whole set.",
    "difficulty.hardTitle": "Hard",
    "difficulty.hardDesc": "Bigger fused rings show up often.",
    "difficulty.expertTitle": "Expert",
    "difficulty.expertDesc": "Coronene and friends, frequently.",
    back: "Back",
    "game.home": "Home", "game.pause": "Pause", "game.resume": "Resume",
    "game.next": "Next", "game.fallingLabel": "Falling", "game.newGame": "New Game",
    "controls.left": "Left", "controls.rotate": "Rotate", "controls.right": "Right",
    "controls.softDrop": "Soft drop", "controls.hardDrop": "Hard drop",
    "gameOver.title": "Game Over", "gameOver.finalScore": "Final score", "gameOver.newBest": "New best score!",
    "paused.title": "Paused",
  },
  ja: {
    subtitle: "多環芳香族ブロックパズル",
    score: "スコア", best: "ベスト", level: "レベル",
    "home.tagline": "縮合環分子を、六角形でつなげよう。遊び方を選んでください。",
    "home.fallingTitle": "フォーリング",
    "home.fallingDesc": "分子がテトリスのように落ちてくる — 操作して回転させ、列を消していこう。",
    "home.placingTitle": "プレイシング",
    "home.placingDesc": "焦らずに — トレイから分子を選んで、盤面の好きな場所に置こう。",
    "lang.label": "言語",
    "orientation.tagline": "六角形の向きはどちらにしますか？",
    "orientation.flatTitle": "フラットトップ",
    "orientation.flatDesc": "まっすぐ縦に落ちる。左右移動はやや斜めにずれる。",
    "orientation.pointyTitle": "ポインティトップ",
    "orientation.pointyDesc": "左右移動はまっすぐ。落下はやや斜めにずれる。",
    "difficulty.tagline": "分子の複雑さはどのくらいにしますか？",
    "difficulty.easyTitle": "イージー",
    "difficulty.easyDesc": "ベンゼンとナフタレンが中心、たまに大きめの分子も。",
    "difficulty.normalTitle": "ノーマル",
    "difficulty.normalDesc": "全体からバランスよく出現。",
    "difficulty.hardTitle": "ハード",
    "difficulty.hardDesc": "大きな縮合環がよく出現する。",
    "difficulty.expertTitle": "エキスパート",
    "difficulty.expertDesc": "コロネンなどの大物が頻繁に出現。",
    back: "戻る",
    "game.home": "ホーム", "game.pause": "一時停止", "game.resume": "再開",
    "game.next": "ネクスト", "game.fallingLabel": "落下中", "game.newGame": "ニューゲーム",
    "controls.left": "左", "controls.rotate": "回転", "controls.right": "右",
    "controls.softDrop": "ソフトドロップ", "controls.hardDrop": "ハードドロップ",
    "gameOver.title": "ゲームオーバー", "gameOver.finalScore": "最終スコア", "gameOver.newBest": "自己ベスト更新！",
    "paused.title": "一時停止中",
  },
  zh: {
    subtitle: "多环芳香烃方块拼图",
    score: "分数", best: "最佳", level: "等级",
    "home.tagline": "稠环分子，六边形拼接。选择一种玩法。",
    "home.fallingTitle": "下落模式",
    "home.fallingDesc": "分子像俄罗斯方块一样下落——移动、旋转，在堆满之前消除整行。",
    "home.placingTitle": "放置模式",
    "home.placingDesc": "不用着急——从托盘中选择一个分子，放到棋盘上的任意位置。",
    "lang.label": "语言",
    "orientation.tagline": "六边形应该朝哪个方向？",
    "orientation.flatTitle": "平顶",
    "orientation.flatDesc": "垂直下落非常笔直；左右移动会略微偏斜。",
    "orientation.pointyTitle": "尖顶",
    "orientation.pointyDesc": "左右移动非常笔直；下落会略微偏斜。",
    "difficulty.tagline": "分子应该有多复杂？",
    "difficulty.easyTitle": "简单",
    "difficulty.easyDesc": "主要是苯和萘，偶尔出现较大的分子。",
    "difficulty.normalTitle": "普通",
    "difficulty.normalDesc": "各种分子均衡出现。",
    "difficulty.hardTitle": "困难",
    "difficulty.hardDesc": "较大的稠环分子经常出现。",
    "difficulty.expertTitle": "专家",
    "difficulty.expertDesc": "晕苯等大分子频繁出现。",
    back: "返回",
    "game.home": "主页", "game.pause": "暂停", "game.resume": "继续",
    "game.next": "下一个", "game.fallingLabel": "下落中", "game.newGame": "新游戏",
    "controls.left": "左", "controls.rotate": "旋转", "controls.right": "右",
    "controls.softDrop": "软降", "controls.hardDrop": "硬降",
    "gameOver.title": "游戏结束", "gameOver.finalScore": "最终分数", "gameOver.newBest": "刷新最佳记录！",
    "paused.title": "已暂停",
  },
  ko: {
    subtitle: "다환 방향족 블록 퍼즐",
    score: "점수", best: "최고 점수", level: "레벨",
    "home.tagline": "고리형 분자를 육각형으로 연결하세요. 플레이 방식을 선택하세요.",
    "home.fallingTitle": "떨어뜨리기",
    "home.fallingDesc": "테트리스처럼 분자가 떨어집니다 — 조작하고 회전시켜 줄을 없애세요.",
    "home.placingTitle": "배치하기",
    "home.placingDesc": "서두르지 마세요 — 트레이에서 분자를 골라 보드 어디든 놓으세요.",
    "lang.label": "언어",
    "orientation.tagline": "육각형은 어느 방향을 향해야 할까요?",
    "orientation.flatTitle": "플랫탑",
    "orientation.flatDesc": "완벽하게 수직으로 떨어집니다. 좌우 이동은 약간 비스듬해집니다.",
    "orientation.pointyTitle": "포인티탑",
    "orientation.pointyDesc": "좌우 이동이 완벽하게 곧습니다. 낙하는 약간 비스듬해집니다.",
    "difficulty.tagline": "분자가 얼마나 복잡해야 할까요?",
    "difficulty.easyTitle": "쉬움",
    "difficulty.easyDesc": "대부분 벤젠과 나프탈렌이며, 가끔 더 큰 분자도 나옵니다.",
    "difficulty.normalTitle": "보통",
    "difficulty.normalDesc": "전체적으로 균형 잡힌 조합입니다.",
    "difficulty.hardTitle": "어려움",
    "difficulty.hardDesc": "더 큰 고리형 분자가 자주 나옵니다.",
    "difficulty.expertTitle": "전문가",
    "difficulty.expertDesc": "코로넨 같은 큰 분자가 자주 나옵니다.",
    back: "뒤로",
    "game.home": "홈", "game.pause": "일시정지", "game.resume": "재개",
    "game.next": "다음", "game.fallingLabel": "떨어지는 중", "game.newGame": "새 게임",
    "controls.left": "왼쪽", "controls.rotate": "회전", "controls.right": "오른쪽",
    "controls.softDrop": "소프트 드롭", "controls.hardDrop": "하드 드롭",
    "gameOver.title": "게임 오버", "gameOver.finalScore": "최종 점수", "gameOver.newBest": "최고 기록 경신!",
    "paused.title": "일시정지됨",
  },
  de: {
    subtitle: "Polyzyklisches aromatisches Block-Puzzle",
    score: "Punkte", best: "Bestwert", level: "Level",
    "home.tagline": "Kondensierte Ringmoleküle, Sechseck für Sechseck. Wähle eine Spielart.",
    "home.fallingTitle": "Fallend",
    "home.fallingDesc": "Moleküle fallen wie bei Tetris — steuern, drehen und volle Reihen auflösen, bevor sie sich stapeln.",
    "home.placingTitle": "Platzieren",
    "home.placingDesc": "Kein Zeitdruck — wähle ein Molekül aus dem Tablett und setze es irgendwo auf das Feld.",
    "lang.label": "Sprache",
    "orientation.tagline": "In welche Richtung sollen die Sechsecke zeigen?",
    "orientation.flatTitle": "Flachseite oben",
    "orientation.flatDesc": "Fällt in einer perfekt geraden Spalte; seitliche Bewegungen driften leicht ab.",
    "orientation.pointyTitle": "Spitze oben",
    "orientation.pointyDesc": "Seitliche Bewegungen sind perfekt gerade; der Fall driftet leicht ab.",
    "difficulty.tagline": "Wie komplex sollen die Moleküle werden?",
    "difficulty.easyTitle": "Leicht",
    "difficulty.easyDesc": "Meist Benzol und Naphthalin, gelegentlich größere Moleküle.",
    "difficulty.normalTitle": "Normal",
    "difficulty.normalDesc": "Eine ausgewogene Mischung aus allen.",
    "difficulty.hardTitle": "Schwer",
    "difficulty.hardDesc": "Größere kondensierte Ringe erscheinen häufig.",
    "difficulty.expertTitle": "Experte",
    "difficulty.expertDesc": "Coronen und Verwandte, häufig.",
    back: "Zurück",
    "game.home": "Start", "game.pause": "Pause", "game.resume": "Fortsetzen",
    "game.next": "Nächstes", "game.fallingLabel": "Fällt gerade", "game.newGame": "Neues Spiel",
    "controls.left": "Links", "controls.rotate": "Drehen", "controls.right": "Rechts",
    "controls.softDrop": "Sanft fallen", "controls.hardDrop": "Hart fallen",
    "gameOver.title": "Spiel vorbei", "gameOver.finalScore": "Endpunktzahl", "gameOver.newBest": "Neuer Bestwert!",
    "paused.title": "Pausiert",
  },
  fr: {
    subtitle: "Puzzle de blocs aromatiques polycycliques",
    score: "Score", best: "Meilleur", level: "Niveau",
    "home.tagline": "Molécules à cycles fusionnés, hexagone par hexagone. Choisissez un mode de jeu.",
    "home.fallingTitle": "Chute",
    "home.fallingDesc": "Les molécules tombent comme au Tetris — dirigez, pivotez et effacez les lignes complètes avant qu'elles ne s'empilent.",
    "home.placingTitle": "Placement",
    "home.placingDesc": "Sans précipitation — choisissez une molécule dans le plateau et posez-la où vous voulez sur le tableau.",
    "lang.label": "Langue",
    "orientation.tagline": "Dans quel sens les hexagones doivent-ils pointer ?",
    "orientation.flatTitle": "Sommet plat",
    "orientation.flatDesc": "Tombe en colonne parfaitement droite ; les déplacements latéraux dérivent légèrement.",
    "orientation.pointyTitle": "Sommet pointu",
    "orientation.pointyDesc": "Les déplacements latéraux sont parfaitement droits ; la chute dérive légèrement.",
    "difficulty.tagline": "À quel point les molécules doivent-elles être complexes ?",
    "difficulty.easyTitle": "Facile",
    "difficulty.easyDesc": "Surtout du benzène et du naphtalène, quelques plus grosses de temps en temps.",
    "difficulty.normalTitle": "Normal",
    "difficulty.normalDesc": "Un mélange équilibré de tout l'ensemble.",
    "difficulty.hardTitle": "Difficile",
    "difficulty.hardDesc": "Les grands cycles fusionnés apparaissent souvent.",
    "difficulty.expertTitle": "Expert",
    "difficulty.expertDesc": "Coronène et consorts, fréquemment.",
    back: "Retour",
    "game.home": "Accueil", "game.pause": "Pause", "game.resume": "Reprendre",
    "game.next": "Suivant", "game.fallingLabel": "En train de tomber", "game.newGame": "Nouvelle partie",
    "controls.left": "Gauche", "controls.rotate": "Pivoter", "controls.right": "Droite",
    "controls.softDrop": "Descente douce", "controls.hardDrop": "Chute rapide",
    "gameOver.title": "Partie terminée", "gameOver.finalScore": "Score final", "gameOver.newBest": "Nouveau meilleur score !",
    "paused.title": "En pause",
  },
};

const LANG_NAMES = { en: "English", ja: "日本語", zh: "中文", ko: "한국어", de: "Deutsch", fr: "Français" };
const LANG_STORAGE_KEY = "pahBlockPuzzleLang";

let currentLang = "en";

function detectDefaultLang() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && TRANSLATIONS[stored]) return stored;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return TRANSLATIONS[nav] ? nav : "en";
}

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyTranslations();
  document.querySelectorAll(".lang-pill").forEach((el) => {
    el.classList.toggle("active", el.dataset.lang === lang);
  });
}

function initI18n() {
  currentLang = detectDefaultLang();
  const container = document.getElementById("lang-selector");
  Object.keys(LANG_NAMES).forEach((lang) => {
    const btn = document.createElement("button");
    btn.className = "lang-pill" + (lang === currentLang ? " active" : "");
    btn.dataset.lang = lang;
    btn.textContent = LANG_NAMES[lang];
    btn.addEventListener("click", () => setLanguage(lang));
    container.appendChild(btn);
  });
  applyTranslations();
}

initI18n();
