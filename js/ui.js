const copy = {
  en: {
    tagline: "Spacetime field",
    kicker: "Nice ticking sound",
    slogan: 'Time, <em>softly</em> present.',
    lede: "Animated clock themes and a quiet tick. For focus, study, and the hours you cannot sleep.",
    meta1: "Themes & widgets",
    meta2: "iOS · Android",
    meta3: "Unlock once",
    more: "Tap for details",
    detailKicker: "About Fun Clock",
    detailTitle: "A quiet screen that keeps time with you.",
    detailLead: "Put it on the desk while you work, or beside the pillow when sleep will not come. Soft ticking sounds and living clock worlds — aurora, firefly, ink, neon, and more.",
    f1t: "Many clock worlds",
    f1d: "Aurora, fireflies, ink wash, neon rain, sakura, clockwork — each one moves.",
    f2t: "A real tick",
    f2d: "Light ticking sounds paired with the animation, so every second has weight.",
    f3t: "Charging & widgets",
    f3d: "Stay on while charging. iOS home widgets for your favorite moods.",
    f4t: "Unlock once",
    f4d: "One purchase opens every theme and removes ads. No subscription.",
    hint: "Drag to orbit · scroll to zoom",
    apk: "APK",
    privacy: "Privacy",
    close: "Close"
  },
  zh: {
    tagline: "时空场域",
    kicker: "轻快的滴答声",
    slogan: '时间，轻轻地在。',
    lede: "动画时钟与轻快滴答声。适合放在桌上专注，也适合失眠时搁在枕边。",
    meta1: "主题与小组件",
    meta2: "iOS · Android",
    meta3: "一次解锁",
    more: "点击查看详情",
    detailKicker: "关于有趣时钟",
    detailTitle: "一块安静陪你走时的屏幕。",
    detailLead: "工作时放在桌上，睡不着时放在枕边。轻快滴答声，和会呼吸的时钟世界——极光、萤火、水墨、霓虹……",
    f1t: "许多时钟世界",
    f1d: "极光、萤火、水墨、雨夜霓虹、樱落、发条——每款都在动。",
    f2t: "真的在滴答",
    f2d: "轻快滴答声与动画同拍，每一秒都有重量。",
    f3t: "充电与小组件",
    f3d: "充电时可一直亮着。iOS 主屏幕小组件随时换心情。",
    f4t: "一次解锁",
    f4d: "一次购买打开全部主题并去除广告，没有订阅。",
    hint: "拖动环绕 · 滚轮缩放",
    apk: "APK",
    privacy: "隐私",
    close: "关闭"
  },
  ja: {
    tagline: "時空フィールド",
    kicker: "やさしいチクタク",
    slogan: '時間は、静かにそばに。',
    lede: "動く時計とやさしい音。集中したい机の上にも、眠れない夜の枕元にも。",
    meta1: "テーマとウィジェット",
    meta2: "iOS · Android",
    meta3: "一度の購入",
    more: "詳細を見る",
    detailKicker: "Fun Clock について",
    detailTitle: "静かに時をそばに置く画面。",
    detailLead: "仕事中は机に。眠れない夜は枕元に。やさしいチクタクと、動く時計の世界——オーロラ、ホタル、水墨、ネオン。",
    f1t: "さまざまな時計世界",
    f1d: "オーロラ、ホタル、水墨、雨のネオン、桜、ぜんまい。どれも動いています。",
    f2t: "本物の一秒",
    f2d: "軽いチクタク音。アニメと一緒に、秒に重みを持たせます。",
    f3t: "充電とウィジェット",
    f3d: "充電中も表示したまま。お気に入りの気分を iOS ウィジェットに。",
    f4t: "一度の購入",
    f4d: "一度払えば全テーマが開き、広告も消えます。サブスクはありません。",
    hint: "ドラッグで回転 · スクロールでズーム",
    apk: "APK",
    privacy: "プライバシー",
    close: "閉じる"
  }
};

const titles = {
  en: "Fun Clock — Nice Ticking Sound | Animated Clock Themes for Focus & Sleep",
  zh: "有趣时钟 — 时空场域",
  ja: "Fun Clock — 時空フィールド"
};

function detectSystemLang() {
  const list = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || "en"];
  for (const raw of list) {
    const code = String(raw || "").toLowerCase();
    if (code.startsWith("zh")) return "zh";
    if (code.startsWith("ja")) return "ja";
    if (code.startsWith("en")) return "en";
  }
  return "en";
}

function applyLang(lang, persist) {
  const pack = copy[lang] || copy.en;
  document.documentElement.lang = copy[lang] ? lang : "en";
  document.title = titles[document.documentElement.lang];
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (pack[key]) node.textContent = pack[key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    const key = node.getAttribute("data-i18n-html");
    if (pack[key]) node.innerHTML = pack[key];
  });
  document.querySelectorAll("[data-set-lang]").forEach((btn) => {
    btn.setAttribute(
      "aria-pressed",
      btn.getAttribute("data-set-lang") === document.documentElement.lang ? "true" : "false"
    );
  });
  if (persist) {
    try { localStorage.setItem("funclock-lang", document.documentElement.lang); } catch (e) {}
  }
  const closeBtn = document.getElementById("detail-close");
  if (closeBtn && pack.close) closeBtn.setAttribute("aria-label", pack.close);
}

document.querySelectorAll("[data-set-lang]").forEach((btn) => {
  btn.addEventListener("click", () => applyLang(btn.getAttribute("data-set-lang"), true));
});

let initial = detectSystemLang();
try {
  const saved = localStorage.getItem("funclock-lang");
  if (saved && copy[saved]) initial = saved;
} catch (e) {}
applyLang(initial, false);

const introEl = document.getElementById("intro");
const detailEl = document.getElementById("detail");
const detailClose = document.getElementById("detail-close");

function setDetailOpen(open) {
  document.body.classList.toggle("is-detail", open);
  introEl.setAttribute("aria-expanded", open ? "true" : "false");
  detailEl.setAttribute("aria-hidden", open ? "false" : "true");
  window.__sceneFocus = open ? 1 : 0;
}

introEl.addEventListener("click", () => setDetailOpen(true));
introEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    setDetailOpen(true);
  }
});
detailClose.addEventListener("click", () => setDetailOpen(false));
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("is-detail")) setDetailOpen(false);
});

const clockEl = document.getElementById("clock");
function paintTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  clockEl.innerHTML =
    pad(now.getHours()) +
    "<span>:</span>" +
    pad(now.getMinutes()) +
    "<span>:</span>" +
    pad(now.getSeconds());
}
paintTime();
setInterval(paintTime, 250);
