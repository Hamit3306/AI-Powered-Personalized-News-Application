/* ============================
   CATEGORY COLOR SYSTEM
   ============================ */
const CATEGORY_COLORS = {
  "Teknoloji":  "#2563eb",
  "Bilim":      "#059669",
  "Dünya":      "#d97706",
  "Ekonomi":    "#7c3aed",
  "Kültür":     "#db2777",
  "Spor":       "#ef4444",
  "Gündem":     "#a43f2f",
  "Türkiye":    "#dc2626",
  "Sağlık":     "#0891b2",
  "Eğitim":     "#4f46e5"
};

const API_BASE_URL = window.location.protocol === "file:" ? "http://localhost:3000" : "";

function categoryColor(category) {
  return CATEGORY_COLORS[category] || "#28536b";
}

function inferArticleCategory(article) {
  const text = normalizeText(`${article.title || ""} ${article.summary || ""} ${article.fullText || ""} ${article.sourceUrl || ""} ${article.sourceName || article.source || ""}`);
  const rules = [
    ["Spor", ["spor", "futbol", "basketbol", "voleybol", "super lig", "galatasaray", "fenerbahce", "besiktas", "trabzonspor", "lebron", "survivor"]],
    ["Ekonomi", ["ekonomi", "borsa", "piyasa", "dolar", "euro", "altin", "gumus", "petrol", "maas", "emekli", "promosyon", "vergi", "zam", "enflasyon", "kredi", "banka"]],
    ["Teknoloji", ["teknoloji", "yapay zeka", "nvidia", "siber", "veri", "guvenlik", "skoda", "uygulama", "telefon", "internet", "yazilim", "robot"]],
    ["Bilim", ["bilim", "arastirma", "iklim", "okyanus", "uzay", "nasa", "deprem", "meteoroloji", "sicaklik", "firtina", "saganak", "col tozu"]],
    ["Dünya", ["abd", "cin", "rusya", "ukrayna", "iran", "israil", "avrupa", "nijerya", "lubnan", "venezuela", "trump", "si", "pekin", "hurmuz"]],
    ["Kültür", ["kultur", "sanat", "film", "muzik", "sarkici", "burcu gunes", "irem derici", "konser", "festival", "kitap"]],
    ["Sağlık", ["saglik", "hastane", "doktor", "hasta", "ilac", "ameliyat", "rehine tatbikati"]],
    ["Eğitim", ["egitim", "okul", "ogrenci", "sinav", "universite", "ders", "akademik", "meb"]],
    ["Türkiye", ["istanbul", "ankara", "izmir", "bursa", "antalya", "samsun", "sivas", "kayseri", "malatya", "kutahya", "sirnak", "gaziantep", "nizip", "turkiye"]]
  ];
  const current = article.category;
  if (current && current !== "Gündem" && current !== "Türkiye") return current;
  const scored = rules
    .map(([category, words]) => ({
      category,
      score: words.reduce((sum, word) => sum + (text.includes(normalizeText(word)) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.category || current || "Gündem";
}

/* ============================
   STATE
   ============================ */
const state = {
  data: window.newspaperMockData,
  liveIndex: 0,
  liveTimer: null,
  usingApi: false,
  events: [],
  savedSearches: [],
  newspaperArticles: [],
  currentPage: 1,
  pageSize: 12,
  activePage: "feed",
  activeEntity: "",
  entityInfoCache: {},
  eventFilters: { city: "ISTANBUL", type: "Tümü" },
  viewByCategory: false,
  favoriteFeedOnly: false,
  authToken: localStorage.getItem("newspaperAuthToken") || "",
  authUser: JSON.parse(localStorage.getItem("newspaperAuthUser") || "null")
};

/* ============================
   DOM REFERENCES
   ============================ */
const searchInput          = document.querySelector("#global-search");
const categoryFilter       = document.querySelector("#category-filter");
const sourceFilter         = document.querySelector("#source-filter");
const statusFilter         = document.querySelector("#status-filter");
const dateFilter           = document.querySelector("#date-filter");
const sortFilter           = document.querySelector("#sort-filter");
const saveSearchButton     = document.querySelector("#save-search");
const savedSearchList      = document.querySelector("#saved-search-list");
const recommendedGrid      = document.querySelector("#recommended-grid");
const articlePagination    = document.querySelector("#article-pagination");
const topicTitle           = document.querySelector("#topic-title");
const topicSummary         = document.querySelector("#topic-summary");
const topicRelated         = document.querySelector("#topic-related");
const topicBack            = document.querySelector("#topic-back");
const briefList            = document.querySelector("#brief-list");
const eventCityFilter      = document.querySelector("#event-city-filter");
const eventTypeFilter      = document.querySelector("#event-type-filter");
const headlineList         = document.querySelector("#headline-list");
const bookmarkList         = document.querySelector("#bookmark-list");
const emptyState           = document.querySelector("#empty-state");
const liveNewsCard         = document.querySelector("#live-news-card");
const liveNewsDots         = document.querySelector("#live-news-dots");
const liveCount            = document.querySelector("#live-count");
const timerBar             = document.querySelector("#timer-bar");
const detailPanel          = document.querySelector("#article-detail");
const detailContent        = document.querySelector("#article-detail-content");
const readerBackdrop       = document.querySelector("#reader-backdrop");
const profileDetail        = document.querySelector("#profile-detail");
const profileBackdrop      = document.querySelector("#profile-backdrop");
const openProfileButton    = document.querySelector("#open-profile");
const closeProfileButton   = document.querySelector("#close-profile");
const profileChipName      = document.querySelector(".profile-chip strong");
const profileChipAvatar    = document.querySelector(".profile-chip .avatar");
const brandTitle           = document.querySelector("#brand-title");
const openNotificationsButton = document.querySelector("#open-notifications");
const notificationPopover  = document.querySelector("#notification-popover");
const notificationList     = document.querySelector("#notification-list");
const markNotificationsReadButton = document.querySelector("#mark-notifications-read");
const editionCalendarPopover = document.querySelector("#edition-calendar-popover");
const editionCalendarGrid = document.querySelector("#edition-calendar-grid");
const calendarMonthLabel = document.querySelector("#calendar-month-label");
const calendarAgenda = document.querySelector("#calendar-agenda");
const calendarReminderCount = document.querySelector("#calendar-reminder-count");
const calendarTimeInput = document.querySelector("#calendar-time-input");
const calendarNoteInput = document.querySelector("#calendar-note-input");
const calendarSaveNoteButton = document.querySelector("#calendar-save-note");
const logoutButton = document.querySelector("#logout-button");
const integrationStatus    = document.querySelector("#integration-status");
const integrationResult    = document.querySelector("#integration-result");
const printEditionButton   = document.querySelector("#print-edition");
const downloadPdfButton    = document.querySelector("#download-pdf");
const printPreview         = document.querySelector("#print-preview");
const exportArticleList    = document.querySelector("#export-article-list");
const profileForm          = document.querySelector("#profile-form");
const profileNameInput     = document.querySelector("#profile-name");
const profileAvatarInput   = document.querySelector("#profile-avatar-input");
const profileAvatarPreview = document.querySelector("#profile-avatar-preview");
const newspaperTitleMode   = document.querySelector("#newspaper-title-mode");
const newspaperTitlePreview = document.querySelector("#newspaper-title-preview");
const profileLanguage      = document.querySelector("#profile-language");
const interestList         = document.querySelector("#interest-list");
const darkModeToggle       = document.querySelector("#dark-mode-toggle");
const notificationToggle   = document.querySelector("#notification-toggle");
const fontSizeRange        = document.querySelector("#font-size-range");
const fontSizeValue        = document.querySelector("#font-size-value");
const readingGoalInput     = document.querySelector("#reading-goal-input");
const resetPreferencesButton = document.querySelector("#reset-preferences");
const profileStatus        = document.querySelector("#profile-status");
const readingStats         = document.querySelector("#reading-stats");
const categoryChart        = document.querySelector("#category-chart");
const authOverlay          = document.querySelector("#auth-overlay");
const authStatus           = document.querySelector("#auth-status");
const loginForm            = document.querySelector("#login-form");
const registerForm         = document.querySelector("#register-form");
const onboardingForm       = document.querySelector("#onboarding-form");
const loginUsername        = document.querySelector("#login-username");
const loginPassword        = document.querySelector("#login-password");
const registerUsername     = document.querySelector("#register-username");
const registerPassword     = document.querySelector("#register-password");
const registerPasswordRepeat = document.querySelector("#register-password-repeat");
const onboardingGoal       = document.querySelector("#onboarding-goal");

/* ============================
   UTILITIES
   ============================ */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function usernameToEmail(username) {
  const clean = normalizeText(username)
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/\s+/g, ".") || "okur";
  return `${clean}@kisisel-gazetem.local`;
}

function onboardingKey(username = state.authUser?.name) {
  return `newspaperOnboardingComplete:${normalizeText(username || "demo")}`;
}

/* ============================
   TOAST NOTIFICATIONS
   ============================ */
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
  });
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ============================
   AUTH
   ============================ */
function setAuthSession(payload, username) {
  state.authToken = payload.token;
  state.authUser = payload.user || { name: username };
  localStorage.setItem("newspaperAuthToken", state.authToken);
  localStorage.setItem("newspaperAuthUser", JSON.stringify(state.authUser));
}

function showAuthStep(step) {
  if (!loginForm || !registerForm || !onboardingForm) return;
  loginForm.hidden   = step !== "login";
  registerForm.hidden = step !== "register";
  onboardingForm.hidden = step !== "onboarding";
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === step);
  });
}

function sourceLogoUrl(sourceUrl) {
  try {
    const domain = new URL(sourceUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch { return ""; }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {})
    },
    ...options
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text.replace(/^\uFEFF/, "")) : {};
  } catch {
    payload = { error: text || "Sunucudan JSON olmayan cevap geldi." };
  }
  if (!response.ok) throw new Error(payload.error || "API istegi basarisiz.");
  return payload;
}

function toUiArticle(article) {
  const category = inferArticleCategory(article);
  return {
    id: article.id,
    category,
    title: article.title,
    summary: article.summary,
    fullText: article.fullText,
    source: article.sourceName || article.source,
    sourceUrl: article.sourceUrl,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
    date: article.date || new Date(article.publishedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
    dateRange: article.dateRange || "Son 24 saat",
    readTime: article.readTime || `${Math.max(2, Math.round((article.fullText || article.summary || "").length / 900))} dk`,
    relevance: article.relevance ?? 25,
    status: article.status || "Okunmadı",
    bookmarked: Boolean(article.bookmarked),
    aiSummary: article.aiSummary,
    contentStatus: article.contentStatus
  };
}

async function loadBackendData() {
  try {
    const feed = await api("/api/feed");
    const articles = feed.articles.map(toUiArticle);
    state.data = {
      ...state.data,
      articles,
      last24: articles.slice(0, 5).map((article) => ({
        id: article.id,
        category: article.category,
        title: article.title,
        summary: article.summary,
        source: article.source,
        time: article.date
      }))
    };
    state.usingApi = true;
  } catch {
    state.usingApi = false;
  }
}

function updateSelectOptions(select, values, allLabel) {
  const currentValue = select.value;
  const options = [allLabel, ...values.filter(Boolean).sort((a, b) => a.localeCompare(b, "tr-TR"))];
  select.innerHTML = options.map((value) =>
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ).join("");
  select.value = options.includes(currentValue) ? currentValue : allLabel;
}

function populateFilters() {
  updateSelectOptions(categoryFilter, [...new Set(state.data.articles.map((a) => a.category))], "Tümü");
  updateSelectOptions(sourceFilter, [...new Set(state.data.articles.map((a) => a.source))], "Tümü");
}

/* ============================
   PAGE NAVIGATION
   ============================ */
function showPage(pageName) {
  state.activePage = pageName;
  document.body.dataset.activePage = pageName;
  document.querySelectorAll(".page-view").forEach((section) => {
    const pages = (section.dataset.pages || "").split(/\s+/).filter(Boolean);
    section.hidden = !pages.includes(pageName);
  });
  // Legacy section-list nav
  document.querySelectorAll(".section-list a[data-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageName);
  });
  // Edition tab nav
  document.querySelectorAll(".etab[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });
  if (pageName === "feed" || pageName === "search") {
    renderArticles();
  }
  if (pageName === "calendar") {
    renderEditionCalendar();
  }
}

/* ============================
   PREFERENCES
   ============================ */
function normalizePreferences(preferences = {}) {
  const validReadingTimes = ["morning", "noon", "evening", "night"];
  const validDepths = ["short", "detailed", "mixed"];
  return {
    interests: Array.isArray(preferences.interests) && preferences.interests.length
      ? preferences.interests : ["Teknoloji", "Bilim"],
    preferredSources: Array.isArray(preferences.preferredSources) ? preferences.preferredSources : [],
    readingTimes: Array.isArray(preferences.readingTimes)
      ? preferences.readingTimes.filter((t) => validReadingTimes.includes(t))
      : [],
    contentDepth: validDepths.includes(preferences.contentDepth) ? preferences.contentDepth : "mixed",
    readingMode: preferences.readingMode || "daily",
    language: preferences.language || "tr",
    notifications: preferences.notifications !== false,
    darkMode: Boolean(preferences.darkMode),
    fontScale: Math.min(120, Math.max(90, Number(preferences.fontScale || 100))),
    readingGoal: Math.max(1, Number(preferences.readingGoal || 20))
  };
}

function applyReadabilityPreferences(preferences) {
  const fontScale = Math.min(120, Math.max(90, Number(preferences.fontScale || 100)));
  document.documentElement.classList.toggle("dark-mode", Boolean(preferences.darkMode));
  document.documentElement.style.fontSize = `${fontScale}%`;
  document.documentElement.style.setProperty("--read-scale", String(fontScale / 100));
  if (fontSizeValue) fontSizeValue.textContent = `${fontScale}%`;
  document.body.dataset.depth = preferences.contentDepth || "mixed";
}

const READING_TIME_LABELS = {
  morning: { label: "Sabah okuyucusu", icon: "fa-mug-saucer", range: [5, 11] },
  noon:    { label: "Öğle okuyucusu",  icon: "fa-sun",         range: [11, 17] },
  evening: { label: "Akşam okuyucusu", icon: "fa-cloud-sun",   range: [17, 22] },
  night:   { label: "Gece okuyucusu",  icon: "fa-moon",        range: [22, 5] }
};

const CONTENT_DEPTH_LABELS = {
  short:    { label: "Hızlı özet stili", icon: "fa-bolt" },
  mixed:    { label: "Karma okuyucu",    icon: "fa-shuffle" },
  detailed: { label: "Detay tutkunu",    icon: "fa-book-open" }
};

function currentTimeSlot() {
  const hour = new Date().getHours();
  for (const [slot, info] of Object.entries(READING_TIME_LABELS)) {
    const [start, end] = info.range;
    if (start < end) {
      if (hour >= start && hour < end) return slot;
    } else {
      if (hour >= start || hour < end) return slot;
    }
  }
  return null;
}

function trimSummary(text) {
  const depth = state.data.preferences?.contentDepth || "mixed";
  const limits = { short: 80, mixed: 160, detailed: 280 };
  const limit = limits[depth] || 160;
  const clean = String(text || "").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit).replace(/\s+\S*$/, "") + "…";
}

let pendingRegister = null;
const PROFILE_AVATAR_KEY = "smartNewspaperProfileAvatar";
const NEWSPAPER_TITLE_MODE_KEY = "smartNewspaperTitleMode";
const NOTIFICATION_READ_KEY = "smartNewspaperReadNotifications";
const CALENDAR_PERSONAL_KEY = "smartNewspaperCalendarPersonalization";
let selectedCalendarDay = "";

function getStoredReadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY) || "[]"); }
  catch { return []; }
}

function setStoredReadNotifications(ids) {
  localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify([...new Set(ids)]));
}

function getCalendarPersonalization() {
  try { return JSON.parse(localStorage.getItem(CALENDAR_PERSONAL_KEY) || "{}"); }
  catch { return {}; }
}

function saveCalendarPersonalization(data) {
  localStorage.setItem(CALENDAR_PERSONAL_KEY, JSON.stringify(data));
}

function initialsFromName(name) {
  return String(name || "Okur").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toLocaleUpperCase("tr-TR") || "OK";
}

function newspaperTitleForName(name) {
  const first = String(name || "Okur").trim().split(/\s+/)[0] || "Okur";
  return `${first}'in Gazetesi`;
}

function updateNewspaperTitle(name = profileNameInput?.value || state.authUser?.name) {
  const mode = localStorage.getItem(NEWSPAPER_TITLE_MODE_KEY) || "personalized";
  const title = mode === "classic" ? "Kişisel Gazetem" : newspaperTitleForName(name);
  if (brandTitle) brandTitle.textContent = title;
  if (newspaperTitleMode) newspaperTitleMode.value = mode;
  if (newspaperTitlePreview) newspaperTitlePreview.textContent = title;
}

function renderAvatar(target, name) {
  if (!target) return;
  const avatar = localStorage.getItem(PROFILE_AVATAR_KEY);
  if (avatar) {
    target.innerHTML = `<img src="${avatar}" alt="">`;
  } else {
    target.textContent = initialsFromName(name);
  }
}

function updateProfileChip(name) {
  const displayName = name || state.authUser?.name || "Kullanıcı";
  if (profileChipName) profileChipName.textContent = displayName;
  renderAvatar(profileChipAvatar, displayName);
  renderAvatar(profileAvatarPreview, displayName);
  updateNewspaperTitle(displayName);
}

function renderProfileForm(profile) {
  const preferences = normalizePreferences(profile?.preferences);
  state.data.preferences = preferences;
  if (profile?.user?.name) {
    state.authUser = { ...(state.authUser || {}), ...profile.user };
    localStorage.setItem("newspaperAuthUser", JSON.stringify(state.authUser));
  }
  if (profileNameInput) profileNameInput.value = profile?.user?.name || state.authUser?.name || "Kullanıcı";
  updateProfileChip(profileNameInput?.value);
  updateNewspaperTitle(profileNameInput?.value);
  if (profileLanguage) profileLanguage.value = preferences.language;
  if (darkModeToggle) darkModeToggle.checked = preferences.darkMode;
  if (notificationToggle) notificationToggle.checked = preferences.notifications;
  if (fontSizeRange) fontSizeRange.value = preferences.fontScale;
  if (readingGoalInput) readingGoalInput.value = preferences.readingGoal;
  interestList?.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.checked = preferences.interests.includes(input.value);
  });
  document.querySelectorAll("#profile-reading-times input[name='readingTime']").forEach((input) => {
    input.checked = preferences.readingTimes.includes(input.value);
  });
  document.querySelectorAll("#profile-content-depth input[name='contentDepth']").forEach((input) => {
    input.checked = input.value === preferences.contentDepth;
  });
  applyReadabilityPreferences(preferences);
  renderReadingInsights();
  renderInterestCloud();
  renderCategoryNav(state.data.articles || []);
  renderPersonaChips();
  updateEditionStrip();
  applyReadingTimeBanner();
}

function getProfileFormPayload() {
  const interests = [...interestList.querySelectorAll("input[type='checkbox']:checked")].map((i) => i.value);
  const readingTimes = [...document.querySelectorAll("#profile-reading-times input[name='readingTime']:checked")].map((i) => i.value);
  const contentDepth = document.querySelector("#profile-content-depth input[name='contentDepth']:checked")?.value || "mixed";
  return {
    name: profileNameInput.value.trim(),
    preferences: normalizePreferences({
      interests,
      readingTimes,
      contentDepth,
      language: profileLanguage.value,
      notifications: notificationToggle.checked,
      darkMode: darkModeToggle.checked,
      fontScale: Number(fontSizeRange.value),
      readingGoal: Number(readingGoalInput.value)
    })
  };
}

async function loadProfile() {
  try {
    const profile = state.usingApi ? await api("/api/profile") : {
      user: { name: state.authUser?.name || "Kullanıcı" },
      preferences: state.data.preferences
    };
    renderProfileForm(profile);
  } catch (error) {
    if (profileStatus) profileStatus.textContent = `Profil yüklenemedi: ${error.message}`;
    renderProfileForm({});
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const payload = getProfileFormPayload();
  if (!payload.name) { profileStatus.textContent = "Ad soyad alanı boş bırakılamaz."; return; }
  if (!payload.preferences.interests.length) { profileStatus.textContent = "En az bir ilgi alanı seçilmelidir."; return; }

  const previousData = state.data;
  try {
    profileStatus.textContent = "Kaydediliyor...";
    applyReadabilityPreferences(payload.preferences);
    updateProfileChip(payload.name);
    updateNewspaperTitle(payload.name);
    state.authUser = { ...(state.authUser || {}), name: payload.name };
    localStorage.setItem("newspaperAuthUser", JSON.stringify(state.authUser));
    state.data.preferences = payload.preferences;
    if (state.usingApi) {
      await api("/api/profile", { method: "PUT", body: JSON.stringify({ name: payload.name }) });
      await api("/api/profile/preferences", { method: "PUT", body: JSON.stringify(payload.preferences) });
      await loadBackendData();
      populateFilters();
      renderStaticLists();
      renderArticles();
      renderExportArticleOptions();
      startLiveNews();
    }
    renderArticles();
    renderExportArticleOptions();
    renderInterestCloud();
    updateEditionStrip();
    renderNotifications();
    profileStatus.textContent = "Tercihler kaydedildi ve akış güncellendi.";
    showToast("Tercihler kaydedildi.", "success");
  } catch (error) {
    state.data = previousData;
    profileStatus.textContent = `Kaydetme başarısız: ${error.message}`;
    await loadProfile();
    renderArticles();
    startLiveNews();
  }
}

function resetProfilePreferences() {
  renderProfileForm({
    user: { name: profileNameInput.value || state.authUser?.name || "Kullanıcı" },
    preferences: { interests: ["Teknoloji", "Bilim", "Dünya"], language: "tr", notifications: true, darkMode: false, fontScale: 100, readingGoal: 20 }
  });
  profileStatus.textContent = "Varsayılan tercihler forma yüklendi. Kalıcı yapmak için Kaydet'i kullan.";
}

function logout() {
  localStorage.removeItem("newspaperAuthToken");
  localStorage.removeItem("newspaperAuthUser");
  state.authToken = "";
  state.authUser = null;
  closeProfileDetail();
  pendingRegister = null;
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  authStatus.textContent = "Oturum kapatıldı.";
  showAuthStep("login");
  authOverlay.hidden = false;
  showToast("Çıkış yapıldı.", "info");
}

function getNotificationItems() {
  const now = new Date();
  const todayKey = dateKey(now);
  const personal = getCalendarPersonalization();
  
  const personalReminders = [];
  // Get reminders for today and tomorrow
  [todayKey, dateKey(new Date(now.getTime() + 86400000))].forEach(key => {
    const dayData = personal[key];
    if (dayData && Array.isArray(dayData.reminders)) {
      const dayDate = new Date(key);
      dayData.reminders.forEach((rem, idx) => {
        if (rem.time && rem.time.includes(":")) {
          const [h, m] = rem.time.split(":").map(Number);
          const reminderDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, m);
          const diffMs = reminderDate - now;
          
          if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
            const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
            const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            let timeLabel = hoursLeft > 0 ? `${hoursLeft} saat kaldı` : `${minutesLeft} dakika kaldı`;

            personalReminders.push({
              id: `personal:${key}:${idx}`,
              type: "Hatırlatıcı",
              title: rem.note || "Etkinlik",
              body: `Saat ${rem.time}'da gerçekleşecek.`,
              timeRemaining: timeLabel,
              icon: "fa-clock"
            });
          }
        }
      });
    }
  });

  const corporateReminders = (state.events || [])
    .filter((event) => event.reminder)
    .map((event) => {
      const item = {
        id: `event:${event.id}`,
        type: "Etkinlik",
        title: event.title,
        body: event.venue || event.summary || "Hatırlatıcı kuruldu.",
        icon: "fa-calendar-check"
      };
      if (event.date) {
        const diffMs = new Date(event.date) - now;
        if (diffMs > 0 && diffMs < 72 * 60 * 60 * 1000) {
          const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
          const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          item.timeRemaining = hoursLeft > 0 ? `${hoursLeft} saat kaldı` : `${minutesLeft} dakika kaldı`;
        }
      }
      return item;
    });

  return [...personalReminders, ...corporateReminders].slice(0, 10);
}

function renderNotifications() {
  if (!notificationList) return;
  const preferences = normalizePreferences(state.data.preferences);
  const items = getNotificationItems();
  const readIds = getStoredReadNotifications();
  const unreadCount = preferences.notifications ? items.filter((item) => !readIds.includes(item.id)).length : 0;
  const dot = document.getElementById("notif-dot");
  if (dot) {
    dot.hidden = unreadCount === 0;
    dot.textContent = unreadCount > 9 ? "9+" : String(unreadCount || "");
  }
  if (!preferences.notifications) {
    notificationList.innerHTML = `<p class="notification-empty">Bildirimler profil tercihlerinde kapalı.</p>`;
    return;
  }
  if (!items.length) {
    notificationList.innerHTML = `<p class="notification-empty">Şimdilik yeni bildirim yok.</p>`;
    return;
  }
  notificationList.innerHTML = items.map((item) => {
    const unread = !readIds.includes(item.id);
    return `
      <button type="button" class="notification-item ${unread ? "is-unread" : ""}" data-notification-id="${escapeHtml(item.id)}">
        <i class="fa-solid ${escapeHtml(item.icon)}"></i>
        <span>
          <small>${escapeHtml(item.type)}${item.timeRemaining ? ` · <span class="notif-time-left">${escapeHtml(item.timeRemaining)}</span>` : ""}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <em>${escapeHtml(item.body)}</em>
        </span>
      </button>
    `;
  }).join("");
}

function toggleNotifications(forceOpen) {
  if (!notificationPopover || !openNotificationsButton) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : notificationPopover.hidden;
  notificationPopover.hidden = !shouldOpen;
  openNotificationsButton.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) renderNotifications();
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarReadingLabel(slot) {
  if (!slot) return "";
  const labels = {
    morning: "Sabah okuma vakti",
    noon: "Öğle okuma vakti",
    evening: "Akşam okuma vakti",
    night: "Gece okuma vakti"
  };
  return labels[slot] || `${slot} okuma vakti`;
}

function updateCalendarAgenda(dayKey, reminderByDay) {
  if (!calendarAgenda) return;
  const personal = getCalendarPersonalization();
  const dayData = personal[dayKey] || {};
  if (calendarTimeInput) calendarTimeInput.value = "09:00";
  if (calendarNoteInput) calendarNoteInput.value = "";
  
  const events = reminderByDay.get(dayKey) || [];
  const combinedReminders = Array.isArray(dayData.reminders) ? dayData.reminders : [];
  
  const parts = [];
  
  // Show combined reminders (Time + Note)
  combinedReminders.sort((a, b) => a.time.localeCompare(b.time)).forEach((rem) => {
    parts.push(`
      <div class="calendar-agenda-item is-reading">
        <strong>${escapeHtml(rem.time)} ${escapeHtml(rem.note)}</strong>
        <span>Kişisel hatırlatıcı</span>
      </div>
    `);
  });

  for (const event of events) {
    parts.push(`
      <div class="calendar-agenda-item is-event">
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.displayDate)}${event.venue ? ` · ${escapeHtml(event.venue)}` : ""}</span>
      </div>
    `);
  }
  calendarAgenda.innerHTML = parts.join("") || `<p>Bu gün için etkinlik ya da kişisel hatırlatıcı yok.</p>`;
}

function renderEditionCalendar() {
  if (!editionCalendarGrid) return;
  const now = new Date();
  if (!selectedCalendarDay) selectedCalendarDay = dateKey(now);
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayKey = dateKey(now);
  const personal = getCalendarPersonalization();
  const reminderEvents = (state.events || []).filter((event) => event.reminder);
  const reminderByDay = new Map();
  for (const event of reminderEvents) {
    const key = dateKey(new Date(event.date));
    reminderByDay.set(key, [...(reminderByDay.get(key) || []), event]);
  }
  if (calendarReminderCount) calendarReminderCount.textContent = String(reminderEvents.length);
  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(`<span class="calendar-day is-empty"></span>`);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const hasReminder = reminderByDay.has(key);
    const isToday = key === todayKey;
    const isSelected = key === selectedCalendarDay;
    const hasPersonal = Boolean(personal[key]?.reminders?.length);
    const isReadingDay = hasPersonal;
    cells.push(`
      <button type="button" class="calendar-day ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""} ${hasReminder ? "has-reminder" : ""} ${isReadingDay ? "has-reading" : ""}" data-calendar-day="${key}" aria-pressed="${isSelected}">
        <span>${day}</span>
      </button>
    `);
  }
  editionCalendarGrid.innerHTML = cells.join("");
  updateCalendarAgenda(selectedCalendarDay, reminderByDay);
}

/* ============================
   PERSONALIZED BANNER & STRIP
   ============================ */
function updateEditionStrip() {
  const preferences = normalizePreferences(state.data.preferences);
  const now = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const userName = state.authUser?.name || profileNameInput?.value || "Kullanıcı";

  const el = (id) => document.getElementById(id);
  if (el("edition-date-display")) el("edition-date-display").textContent = now;
  if (el("edition-interests-display")) el("edition-interests-display").textContent = preferences.interests.slice(0, 4).join(", ");
  if (el("edition-article-count")) el("edition-article-count").textContent = `${state.data.articles.length} haber`;
  if (el("sidebar-user-name")) el("sidebar-user-name").textContent = `${userName.split(" ")[0]} için`;
  if (el("sidebar-date-display")) el("sidebar-date-display").textContent = now;

  const sources = [...new Set(state.data.articles.map((a) => a.source).filter(Boolean))];
  if (el("sidebar-source-count")) el("sidebar-source-count").textContent = `${sources.length} kaynaktan derlendi`;
}

function renderPersonalizedBanner() {
  const banner = document.getElementById("personalized-banner");
  if (!banner) return;

  const preferences = normalizePreferences(state.data.preferences);
  const userName = state.authUser?.name || profileNameInput?.value || "Kullanıcı";
  const articleCount = state.data.articles.length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  const pbGreeting = document.getElementById("pb-greeting");
  const pbMessage  = document.getElementById("pb-message");
  const pbStats    = document.getElementById("pb-stats");

  if (pbGreeting) pbGreeting.textContent = `${greet}, ${userName.split(" ")[0]}`;
  if (pbMessage)  pbMessage.textContent  = `${preferences.interests.join(", ")} kategorilerinden ${articleCount} haber seçildi.`;

  if (pbStats) {
    const insights = getReadingInsights();
    pbStats.innerHTML = `
      <div class="pb-stat"><strong>${insights.readCount}</strong><span>Okunan</span></div>
      <div class="pb-stat"><strong>${insights.bookmarkCount}</strong><span>Kaydedilen</span></div>
      <div class="pb-stat"><strong>${insights.minutes} dk</strong><span>Okuma süresi</span></div>
    `;
  }
  banner.hidden = false;
}

/* ============================
   INTEREST CLOUD & CATEGORY NAV
   ============================ */
function renderInterestCloud() {
  const cloud = document.getElementById("interest-cloud-sidebar");
  if (!cloud) return;
  const preferences = normalizePreferences(state.data.preferences);
  
  let html = preferences.interests.map((interest) => `
    <div class="interest-tag-wrapper">
      <button class="interest-tag" data-cat-interest="${escapeHtml(interest)}"
              style="--cat-color: ${categoryColor(interest)}" title="${escapeHtml(interest)} haberlerini filtrele">
        ${escapeHtml(interest)}
      </button>
      <button class="remove-interest-btn" onclick="toggleInterest('${escapeHtml(interest)}')" title="Çıkar">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `).join("");

  html += `
    <button class="add-interest-btn" onclick="openAddInterestMenu()" title="Yeni İlgi Alanı Ekle">
      <i class="fa-solid fa-plus"></i> Ekle
    </button>
  `;

  cloud.innerHTML = html;
}

async function toggleInterest(interest) {
  const preferences = normalizePreferences(state.data.preferences);
  const exists = preferences.interests.includes(interest);
  
  if (exists) {
    preferences.interests = preferences.interests.filter(i => i !== interest);
  } else {
    preferences.interests.push(interest);
  }
  
  state.data.preferences = preferences;
  
  // Update UI immediately
  renderInterestCloud();
  renderArticles();
  renderPersonaChips();
  renderInterestCloud(); // Double check
  
  showToast(exists ? `${interest} çıkarıldı.` : `${interest} eklendi.`, "success");

  // Persist to API if logged in
  if (state.usingApi) {
    try {
      await api("/api/profile/preferences", { method: "PUT", body: JSON.stringify(preferences) });
    } catch (e) {
      console.error("Preferences sync failed", e);
    }
  }
}

function openAddInterestMenu() {
  const menu = document.getElementById("add-interest-menu");
  if (!menu) return;
  
  const allCategories = [...new Set(state.data.articles.map(a => a.category))];
  const currentInterests = normalizePreferences(state.data.preferences).interests;
  const available = allCategories.filter(cat => !currentInterests.includes(cat));

  if (available.length === 0) {
    showToast("Tüm kategoriler zaten ekli.", "info");
    return;
  }

  menu.innerHTML = `
    <div class="add-menu-header">
      <span>Kategori Ekle</span>
      <button onclick="document.getElementById('add-interest-menu').hidden = true"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="add-menu-list">
      ${available.map(cat => `
        <button class="add-menu-item" onclick="toggleInterest('${escapeHtml(cat)}'); document.getElementById('add-interest-menu').hidden = true;">
          <span class="dot" style="background: ${categoryColor(cat)}"></span>
          ${escapeHtml(cat)}
        </button>
      `).join("")}
    </div>
  `;
  
  menu.hidden = false;
}

function renderCategoryNav(articles) {
  const navList = document.getElementById("category-nav-list");
  if (!navList) return;

  const preferences = normalizePreferences(state.data.preferences);
  const interests = new Set(preferences.interests);
  const counts = {};
  for (const a of articles) { counts[a.category] = (counts[a.category] || 0) + 1; }

  const categories = [...new Set([
    ...preferences.interests,
    ...Object.keys(counts),
    ...Object.keys(CATEGORY_COLORS)
  ])];

  const entries = categories.map((category) => [category, counts[category] || 0]).sort((a, b) => {
    const aScore = interests.has(a[0]) ? 1 : 0;
    const bScore = interests.has(b[0]) ? 1 : 0;
    return bScore - aScore || b[1] - a[1] || a[0].localeCompare(b[0], "tr-TR");
  });

  const allEntry = { category: "Tümü", count: articles.length, isAll: true };
  const rows = [allEntry, ...entries.map(([category, count]) => ({ category, count }))];

  navList.innerHTML = rows.map(({ category, count, isAll }) => {
    const isActive = isAll
      ? categoryFilter.value === "Tümü"
      : categoryFilter.value === category;
    const color = isAll ? null : categoryColor(category);
    const isInterest = !isAll && interests.has(category);
    return `
      <button class="cat-nav-btn${isActive ? " active" : ""}"
              data-cat-filter="${escapeHtml(category)}"
              ${color ? `style="--cat-color: ${color}"` : ""}>
        <span class="cat-nav-dot" ${color ? `style="background:${color}"` : ""}></span>
        <span class="cat-nav-label">${escapeHtml(category)}</span>
        <span class="cat-nav-count">${count}</span>
        ${isInterest ? '<i class="fa-solid fa-star cat-interest-star"></i>' : ""}
      </button>
    `;
  }).join("");
}

/* ============================
   READING GOAL
   ============================ */
function updateReadingGoalUI(insights) {
  const data = insights || getReadingInsights();
  const fill = document.getElementById("rg-fill");
  const fraction = document.getElementById("rg-fraction");
  const label = document.getElementById("rg-label");
  const editionFill = document.getElementById("edition-goal-fill");
  const editionLabel = document.getElementById("edition-goal-label");

  if (fill) fill.style.width = `${data.progress}%`;
  if (fraction) fraction.textContent = `${data.readCount}/${data.goal}`;
  if (editionFill) editionFill.style.width = `${data.progress}%`;
  if (editionLabel) editionLabel.textContent = `${data.readCount}/${data.goal}`;

  if (label) {
    if (data.progress >= 100) label.textContent = "Günlük hedefe ulaştın! 🎉";
    else if (data.progress >= 50) label.textContent = `${data.goal - data.readCount} haber daha`;
    else if (data.readCount > 0) label.textContent = `${data.readCount} haber okundu`;
    else label.textContent = "Okumaya başla";
  }

  const notifDot = document.getElementById("notif-dot");
  renderNotifications();
}

/* ============================
   FEATURED ARTICLE
   ============================ */
function renderFeaturedArticle(articles) {
  const section = document.getElementById("featured-section");
  const el = document.getElementById("featured-article-el");
  const relChip = document.getElementById("featured-rel-chip");
  if (!section || !el) return;

  const featured = articles[0];
  if (!featured) { section.hidden = true; return; }

  section.hidden = false;
  const color = categoryColor(featured.category);
  if (relChip) relChip.textContent = `İlgi puanı: ${featured.relevance}`;

  if (featured.imageUrl) {
    el.innerHTML = `
      <div class="featured-inner">
        <div class="featured-text-area">
          <span class="cat-badge" style="--cat-color:${color};background:${color}">${escapeHtml(featured.category)}</span>
          <div class="article-meta">
            <span>${escapeHtml(featured.source || "")}</span>
            <span>${escapeHtml(featured.date || "")}</span>
            <span>${escapeHtml(featured.readTime || "")}</span>
          </div>
          <h2><button class="title-link" data-action="detail" data-id="${escapeHtml(String(featured.id))}">${escapeHtml(featured.title)}</button></h2>
          <p>${escapeHtml(featured.summary)}</p>
          <div class="article-actions">
            <button data-action="detail" data-id="${escapeHtml(String(featured.id))}">
              <i class="fa-solid fa-book-open"></i> Haberi Oku
            </button>
            <button data-action="bookmark" data-id="${escapeHtml(String(featured.id))}">
              <i class="${featured.bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i>
              ${featured.bookmarked ? "Kaydedildi" : "Kaydet"}
            </button>
            <button data-action="newspaper" data-id="${escapeHtml(String(featured.id))}">
              <i class="fa-solid fa-file-circle-plus"></i>
              ${state.newspaperArticles.includes(String(featured.id)) ? "Gazetede" : "Gazeteye Ekle"}
            </button>
          </div>
        </div>
        <img class="featured-img" src="${escapeHtml(featured.imageUrl)}" alt="" loading="lazy">
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="featured-no-img">
        <span class="cat-badge" style="--cat-color:${color};background:${color}">${escapeHtml(featured.category)}</span>
        <div class="article-meta">
          <span>${escapeHtml(featured.source || "")}</span>
          <span>${escapeHtml(featured.date || "")}</span>
          <span>${escapeHtml(featured.readTime || "")}</span>
        </div>
        <h2><button class="title-link" data-action="detail" data-id="${escapeHtml(String(featured.id))}">${escapeHtml(featured.title)}</button></h2>
        <p>${escapeHtml(featured.summary)}</p>
        <div class="article-actions">
          <button data-action="detail" data-id="${escapeHtml(String(featured.id))}">
            <i class="fa-solid fa-book-open"></i> Haberi Oku
          </button>
          <button data-action="bookmark" data-id="${escapeHtml(String(featured.id))}">
            <i class="${featured.bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i>
            ${featured.bookmarked ? "Kaydedildi" : "Kaydet"}
          </button>
          <button data-action="newspaper" data-id="${escapeHtml(String(featured.id))}">
            <i class="fa-solid fa-file-circle-plus"></i>
            ${state.newspaperArticles.includes(String(featured.id)) ? "Gazetede" : "Gazeteye Ekle"}
          </button>
        </div>
      </div>
    `;
  }

  el.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    await handleArticleAction(btn.dataset.action, findArticleForAction(btn.dataset.id));
  }, { once: true });
}

/* ============================
   ARTICLE CARD HTML
   ============================ */
function renderArticleCardHtml(article) {
  const color = categoryColor(article.category);
  return `
    <article class="article-card" style="--cat-color: ${color}">
      ${article.imageUrl ? `<img class="article-thumb" src="${escapeHtml(article.imageUrl)}" alt="" loading="lazy">` : ""}
      <div class="card-topline">
        <span class="tag">${escapeHtml(article.category)}</span>
        <span class="relevance">İlgi %${Math.round(Number(article.relevance || 75))}</span>
      </div>
      <h4><button class="title-link" data-action="detail" data-id="${escapeHtml(String(article.id))}">${escapeHtml(article.title)}</button></h4>
      <p>${escapeHtml(trimSummary(article.summary))}</p>
      <div class="source-line compact-source">
        <span><i class="fa-solid fa-link"></i> ${escapeHtml(article.source || "")}</span>
        <span>${escapeHtml(article.readTime || "")}</span>
        <span class="${article.status === "Okundu" ? "read-badge" : "unread-badge"}">${escapeHtml(article.status || "Okunmadı")}</span>
      </div>
      <div class="card-actions">
        <button data-action="bookmark" data-id="${escapeHtml(String(article.id))}">
          <i class="${article.bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i>
          ${article.bookmarked ? "Kaydedildi" : "Kaydet"}
        </button>
        <button data-action="newspaper" data-id="${escapeHtml(String(article.id))}">
          <i class="fa-solid fa-file-circle-plus"></i>
          ${state.newspaperArticles.includes(String(article.id)) ? "Gazetede" : "Gazeteye Ekle"}
        </button>
      </div>
    </article>
  `;
}

/* ============================
   PERSONA CHIPS & READING TIME
   ============================ */
function renderPersonaChips() {
  const container = document.getElementById("persona-chips");
  if (!container) return;
  const preferences = normalizePreferences(state.data.preferences);
  const currentSlot = currentTimeSlot();
  const chips = [];

  for (const slot of preferences.readingTimes) {
    const info = READING_TIME_LABELS[slot];
    if (!info) continue;
    const isActive = slot === currentSlot;
    chips.push(`
      <div class="persona-chip-wrapper">
        <span class="persona-chip ${isActive ? "is-active" : ""}" title="${isActive ? "Şu an senin okuma vaktin" : ""}">
          <i class="fa-solid ${info.icon}"></i> ${info.label}
        </span>
      </div>
    `);
  }

  const depth = CONTENT_DEPTH_LABELS[preferences.contentDepth];
  if (depth) {
    chips.push(`
      <div class="persona-chip-wrapper">
        <span class="persona-chip">
          <i class="fa-solid ${depth.icon}"></i> ${depth.label}
        </span>
      </div>
    `);
  }

  container.innerHTML = chips.join("");
}

function applyReadingTimeBanner() {
  const banner = document.getElementById("reading-time-banner");
  const text = document.getElementById("reading-time-banner-text");
  if (!banner || !text) return;
  const preferences = normalizePreferences(state.data.preferences);
  const slot = currentTimeSlot();
  if (!slot || !preferences.readingTimes.includes(slot)) {
    banner.hidden = true;
    return;
  }
  const label = READING_TIME_LABELS[slot]?.label || "";
  text.textContent = `${label} olarak işaretlemişsin — şu an tam senin okuma vaktin.`;
  banner.hidden = false;
}

/* ============================
   EVENTS
   ============================ */
function toUiEvent(event) {
  return {
    id: event.id,
    title: event.title,
    category: event.category || event.type || "Duyuru",
    summary: event.summary || event.body || "",
    description: event.description || event.body || event.summary || "",
    date: event.date,
    displayDate: event.date
      ? new Date(event.date).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
      : event.date || "",
    venue: event.venue || "",
    city: event.city || "",
    imageUrl: event.imageUrl || "",
    ticketUrl: event.ticketUrl || "",
    sourceProvider: event.sourceProvider || "",
    critical: Boolean(event.critical),
    read: Boolean(event.read),
    reminder: Boolean(event.reminder),
    notificationStatus: event.notificationStatus || event.sourceProvider || (event.critical ? "Kritik bildirim" : "Normal")
  };
}

async function loadEvents() {
  if (!state.usingApi) {
    state.events = state.data.briefs.map((item, index) => toUiEvent({
      id: `mock_event_${index}`,
      title: item.title,
      category: item.type,
      summary: item.body,
      description: item.body,
      date: new Date().toISOString()
    }));
    return;
  }
  try {
    const params = new URLSearchParams({
      city: state.eventFilters.city,
      type: state.eventFilters.type
    });
    const payload = await api(`/api/events?${params.toString()}`);
    state.events = payload.events.map(toUiEvent);
  } catch { state.events = []; }
}

function renderEvents() {
  briefList.innerHTML = state.events.map((item) => `
    <article class="announcement-item event-ticket-card ${item.read ? "is-read" : ""}">
      <div class="event-ticket-media">
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">` : `<span>${escapeHtml(item.category)}</span>`}
      </div>
      <div>
        <div class="event-ticket-topline">
          <span>${escapeHtml(item.category)}</span>
          <small>${escapeHtml(item.sourceProvider || item.notificationStatus)}</small>
        </div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="event-ticket-meta">
          <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(item.displayDate)}</span>
          ${item.venue ? `<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.venue)}${item.city ? `, ${escapeHtml(item.city)}` : ""}</span>` : ""}
        </div>
        <p>${escapeHtml(item.summary)}</p>
        <div class="event-actions">
          <button data-event-action="detail" data-id="${escapeHtml(item.id)}">Detay</button>
          ${item.ticketUrl ? `<a class="ticket-link" href="${escapeHtml(item.ticketUrl)}" target="_blank" rel="noopener">Bilet Al</a>` : ""}
          <button data-event-action="read" data-id="${escapeHtml(item.id)}">${item.read ? "Okundu" : "Okundu İşaretle"}</button>
          <button data-event-action="reminder" data-id="${escapeHtml(item.id)}">${item.reminder ? "Hatırlatıcı Açık" : "Hatırlat"}</button>
          <button data-event-action="dismiss" data-id="${escapeHtml(item.id)}">Gizle</button>
        </div>
      </div>
    </article>
  `).join("") || `<p class="empty-state inline">Kurumsal etkinlik veya duyuru bulunamadı.</p>`;
}

async function showEventDetail(eventId) {
  let event = state.events.find((item) => String(item.id) === String(eventId));
  if (state.usingApi) {
    try {
      const payload = await api(`/api/events/${eventId}`);
      event = toUiEvent(payload.event);
    } catch {}
  }
  if (!event) return;
  detailPanel.hidden = false;
  document.body.classList.add("reader-open");
  detailContent.innerHTML = `
    <div class="article-meta">
      <span>${escapeHtml(event.category)}</span>
      <span>${escapeHtml(event.displayDate)}</span>
      <span>${escapeHtml(event.notificationStatus)}</span>
    </div>
    <h2>${escapeHtml(event.title)}</h2>
    ${event.imageUrl ? `<img class="event-detail-image" src="${escapeHtml(event.imageUrl)}" alt="" loading="lazy">` : ""}
    <div class="${event.critical ? "content-warning" : "content-ok"}">
      <strong>${event.critical ? "Kritik duyuru" : "Etkinlik bilgisi"}</strong>
      <p>${escapeHtml(event.summary)}</p>
    </div>
    ${event.venue ? `<p><strong>Mekan:</strong> ${escapeHtml(event.venue)}${event.city ? `, ${escapeHtml(event.city)}` : ""}</p>` : ""}
    <p>${escapeHtml(event.description)}</p>
    ${event.ticketUrl ? `<p><a class="ticket-link detail-ticket-link" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener">Bilet sayfasını aç</a></p>` : ""}
  `;
}

async function handleEventAction(action, eventId) {
  const event = state.events.find((item) => String(item.id) === String(eventId));
  if (!event) return;
  if (action === "detail") { showEventDetail(event.id); return; }
  try {
    if (action === "read") {
      if (state.usingApi) await api(`/api/events/${event.id}/read`, { method: "POST", body: "{}" });
      event.read = true;
      showToast("Okundu olarak işaretlendi.", "success");
    }
    if (action === "reminder") {
      if (state.usingApi) {
        const payload = await api(`/api/events/${event.id}/reminder`, { method: "POST", body: "{}" });
        event.reminder = payload.reminder;
      } else {
        event.reminder = !event.reminder;
      }
      showToast(event.reminder ? "Hatırlatıcı eklendi." : "Hatırlatıcı kaldırıldı.", "info");
      renderEditionCalendar();
    }
    if (action === "dismiss") {
      if (state.usingApi) await api(`/api/events/${event.id}/dismiss`, { method: "POST", body: "{}" });
      state.events = state.events.filter((item) => item.id !== event.id);
      showToast("Duyuru gizlendi.", "info");
    }
    renderEvents();
    renderEditionCalendar();
  } catch (error) {
    integrationResult.textContent = `Duyuru işlemi başarısız: ${error.message}`;
  }
}

/* ============================
   EXPORT / PDF
   ============================ */
function getExportLayout() {
  return document.querySelector("input[name='layout']:checked")?.value || "a4";
}

function getSelectedExportArticles() {
  return state.newspaperArticles
    .map((id) => state.data.articles.find((a) => String(a.id) === String(id)))
    .filter(Boolean);
}

function renderExportArticleOptions() {
  const selected = getSelectedExportArticles();
  exportArticleList.innerHTML = `
    <strong>Gazeteye eklenen haberler</strong>
    ${selected.length ? selected.map((article) => `
      <article class="newspaper-selection-item">
        <span>${escapeHtml(article.title)}</span>
        <button data-remove-newspaper="${escapeHtml(String(article.id))}" type="button">Çıkar</button>
      </article>
    `).join("") : `<p class="empty-state inline">Akıştaki haberlerden "Gazeteye Ekle" butonuyla seçim yap.</p>`}
  `;
  updatePrintPreview();
}

function updatePrintPreview() {
  const layoutNames = { a4: "A4 klasik gazete", tabloid: "Tabloid geniş sayfa", booklet: "Kitapçık düzeni" };
  const selected = getSelectedExportArticles();
  printPreview.innerHTML = `
    <span>Sayfa Önizleme · ${escapeHtml(layoutNames[getExportLayout()] || layoutNames.a4)}</span>
    <strong>Kişisel Gazetem</strong>
    <p>${selected.length} seçili haber ve ${state.events.length} kurumsal duyuru gazete düzeninde gösterilecek.</p>
    <div class="preview-article-list">
      ${selected.length ? selected.map((a) => `<span>${escapeHtml(a.category)} · ${escapeHtml(a.title)}</span>`).join("") : "<span>Henüz haber eklenmedi.</span>"}
    </div>
  `;
}

function openPrintPreview() {
  updatePrintPreview();
  window.print();
}

async function downloadPdf() {
  const selected = getSelectedExportArticles();
  if (!selected.length) { showToast("PDF için en az bir haber seç.", "error"); return; }
  try {
    downloadPdfButton.disabled = true;
    downloadPdfButton.innerHTML = `<i class="fa-solid fa-download"></i> PDF hazırlanıyor...`;
    const response = await fetch(`${API_BASE_URL}/api/export/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layout: getExportLayout(),
        articles: selected.map((a) => ({
          id: a.id, title: a.title, summary: a.summary, fullText: a.fullText,
          category: a.category, sourceName: a.source, publishedAt: a.date,
          imageUrl: a.imageUrl
        }))
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "PDF oluşturulamadı.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kisisel-gazetem-${getExportLayout()}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("PDF oluşturuldu ve indirildi.", "success");
  } catch (error) {
    showToast(`PDF oluşturulamadı: ${error.message}`, "error");
  } finally {
    downloadPdfButton.disabled = false;
    downloadPdfButton.innerHTML = `<i class="fa-solid fa-download"></i> PDF İndir`;
  }
}

/* ============================
   INTEGRATION STATUS
   ============================ */
function renderIntegrationStatus(status) {
  if (!integrationStatus) return;
  const items = [
    ["FreeNewsApi", status.freeNewsApi],
    ["GNews", status.gnews],
    ["NewsAPI", status.newsApi],
    ["Mediastack", status.mediastack],
    ["Gemini", status.gemini],
    ["RSS", status.rssFeeds > 0]
  ];
  integrationStatus.innerHTML = items.map(([name, active]) => `
    <span class="${active ? "active" : ""}">
      <i class="fa-solid ${active ? "fa-circle-check" : "fa-circle-xmark"}"></i>
      ${name}
    </span>
  `).join("");
}

async function refreshIntegrations() {
  if (!integrationResult) return;
  try {
    const status = await api("/api/integrations/status");
    renderIntegrationStatus(status);
    integrationResult.textContent = `Backend çalışıyor. AI modeli: ${status.aiModel || "tanımlı değil"}. RSS kaynak sayısı: ${status.rssFeeds}.`;
  } catch {
    integrationResult.textContent = "Backend çalışmıyor veya bu sayfa doğrudan dosya olarak açıldı. Test için node server.js ile başlat.";
  }
}

async function testNewsApi() {
  integrationResult.textContent = "Haber API test ediliyor...";
  try {
    const payload = await api("/api/integrations/test/news", { method: "POST", body: "{}" });
    integrationResult.innerHTML = `
      <strong>${payload.provider} çalıştı.</strong>
      ${payload.articles.map((a) => `<p>${escapeHtml(a.title || "Başlıksız")} <span>${escapeHtml(a.source || "")}</span></p>`).join("")}
    `;
  } catch (error) {
    integrationResult.textContent = `Haber API testi başarısız: ${error.message}`;
  }
}

async function testAiApi() {
  integrationResult.textContent = "AI API test ediliyor...";
  try {
    const payload = await api("/api/integrations/test/ai", { method: "POST", body: "{}" });
    integrationResult.innerHTML = `<strong>${payload.model || "AI"} çalıştı.</strong><p>${escapeHtml(payload.message)}</p>`;
  } catch (error) {
    integrationResult.textContent = `AI testi başarısız: ${error.message}`;
  }
}

/* ============================
   ARTICLE FILTERING & SORTING
   ============================ */
function articleMatches(article) {
  const query = searchInput.value.trim().toLocaleLowerCase("tr-TR");
  const haystack = `${article.title} ${article.summary} ${article.source} ${article.category}`.toLocaleLowerCase("tr-TR");
  return (!query || haystack.includes(query))
    && (!state.favoriteFeedOnly || Number(article.relevance || 0) >= 75)
    && (categoryFilter.value === "Tümü" || article.category === categoryFilter.value)
    && (sourceFilter.value === "Tümü" || article.source === sourceFilter.value)
    && (statusFilter.value === "Tümü" || article.status === statusFilter.value)
    && (dateFilter.value === "Tümü" || article.dateRange === dateFilter.value);
}

function articlePopularity(article) {
  return Number(article.relevance || 0) + (article.bookmarked ? 10 : 0) + (article.status === "Okundu" ? 4 : 0);
}

function parseReadTimeMinutes(readTime) {
  const value = Number(String(readTime || "").replace(",", ".").match(/\d+(\.\d+)?/)?.[0] || 3);
  return Number.isFinite(value) ? value : 3;
}

function sortArticles(articles) {
  return [...articles].sort((a, b) => {
    if (sortFilter.value === "date") return new Date(b.publishedAt || b.date || 0) - new Date(a.publishedAt || a.date || 0);
    if (sortFilter.value === "popularity") return articlePopularity(b) - articlePopularity(a);
    return Number(b.relevance || 0) - Number(a.relevance || 0);
  });
}

/* ============================
   READING INSIGHTS
   ============================ */
function getReadingInsights() {
  const preferences = normalizePreferences(state.data.preferences);
  const readArticles = state.data.articles.filter((a) => a.status === "Okundu");
  const bookmarkedArticles = state.data.articles.filter((a) => a.bookmarked);
  const weights = new Map();

  for (const article of state.data.articles) {
    let weight = 0;
    if (article.status === "Okundu") weight += 2;
    if (article.bookmarked) weight += 1;
    if (state.newspaperArticles.includes(String(article.id))) weight += 1;
    if (!weight) continue;
    weights.set(article.category, (weights.get(article.category) || 0) + weight);
  }

  const totalWeight = [...weights.values()].reduce((sum, v) => sum + v, 0);
  const categories = [...weights.entries()]
    .map(([category, weight]) => ({
      category,
      weight,
      percent: totalWeight ? Math.round((weight / totalWeight) * 100) : 0
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return {
    goal: preferences.readingGoal,
    progress: Math.min(100, Math.round((readArticles.length / preferences.readingGoal) * 100)),
    readCount: readArticles.length,
    bookmarkCount: bookmarkedArticles.length,
    minutes: Math.round(readArticles.reduce((sum, a) => sum + parseReadTimeMinutes(a.readTime), 0)),
    categories
  };
}

function renderReadingInsights() {
  if (!readingStats || !categoryChart) return;
  const insights = getReadingInsights();

  readingStats.innerHTML = `
    <div><strong>${insights.progress}%</strong><span>Günlük hedef</span></div>
    <div><strong>${insights.readCount}/${insights.goal}</strong><span>Okunan haber</span></div>
    <div><strong>${insights.bookmarkCount}</strong><span>Kaydedilen</span></div>
    <div><strong>${insights.minutes} dk</strong><span>Okuma süresi</span></div>
  `;

  categoryChart.innerHTML = `
    <div class="category-chart-header">İlgi analizi</div>
    ${insights.categories.length ? insights.categories.map((item) => `
      <div class="category-bar">
        <div class="category-bar-row">
          <span>${escapeHtml(item.category)}</span>
          <small>${item.percent}%</small>
        </div>
        <div class="category-track"><i style="width: ${item.percent}%"></i></div>
      </div>
    `).join("") : `<p class="empty-state inline">Henüz okuma sinyali yok. Haberleri okudukça grafik oluşacak.</p>`}
  `;

  updateReadingGoalUI(insights);
}

/* ============================
   LIVE NEWS CAROUSEL
   ============================ */
function renderLiveNews() {
  if (!state.data.last24.length) {
    liveNewsCard.innerHTML = `
      <div class="article-meta"><span>Türkiye Haberleri</span></div>
      <h3>Haber akışı yükleniyor</h3>
      <p>RSS kaynakları bağlandığında son haberler burada görünecek.</p>
    `;
    liveCount.textContent = "00 / 00";
    liveNewsDots.innerHTML = "";
    timerBar.style.animation = "none";
    return;
  }
  const item = state.data.last24[state.liveIndex];
  const color = categoryColor(item.category);
  liveNewsCard.innerHTML = `
    <div class="article-meta">
      <span style="color:${color}">${escapeHtml(item.category)}</span>
      <span>${escapeHtml(item.time || "")}</span>
      <span>${escapeHtml(item.source || "")}</span>
    </div>
    <h3><button class="title-link live-title-link" data-action="detail" data-id="${escapeHtml(String(item.id || ""))}">${escapeHtml(item.title)}</button></h3>
    <p>${escapeHtml(item.summary || "")}</p>
    <div class="article-actions">
      <button data-action="bookmark" data-id="${escapeHtml(String(item.id || ""))}">
        <i class="${item.bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i>
        ${item.bookmarked ? "Kaydedildi" : "Kaydet"}
      </button>
    </div>
  `;

  liveCount.textContent = `${String(state.liveIndex + 1).padStart(2, "0")} / ${String(state.data.last24.length).padStart(2, "0")}`;
  liveNewsDots.innerHTML = state.data.last24.map((_, index) => `
    <button class="${index === state.liveIndex ? "active" : ""}" data-index="${index}" aria-label="${index + 1}. habere geç"></button>
  `).join("");

  timerBar.style.animation = "none";
  void timerBar.offsetHeight;
  timerBar.style.animation = "newsTimer 5s linear forwards";
}

function startLiveNews() {
  clearInterval(state.liveTimer);
  renderLiveNews();
  if (!state.data.last24.length) return;
  state.liveTimer = setInterval(() => {
    state.liveIndex = (state.liveIndex + 1) % state.data.last24.length;
    renderLiveNews();
  }, 5000);
}

/* ============================
   ARTICLE RENDERING
   ============================ */
function renderArticles() {
  const allFiltered = sortArticles(state.data.articles.filter(articleMatches));
  const isFiltered = searchInput.value.trim() || categoryFilter.value !== "Tümü"
    || sourceFilter.value !== "Tümü" || statusFilter.value !== "Tümü" || dateFilter.value !== "Tümü";

  const featuredSection = document.getElementById("featured-section");
  if (featuredSection) featuredSection.hidden = true;
  const feedHeading = document.getElementById("feed-heading");
  if (feedHeading) feedHeading.textContent = state.favoriteFeedOnly ? "Favori Akışın" : "Sana Özel Haberler";
  if (emptyState) {
    emptyState.textContent = state.favoriteFeedOnly
      ? "%75 ve üzeri ilgi puanına sahip haber bulunamadı."
      : "Seçilen filtrelere uygun haber bulunamadı. Filtreleri genişletebilir veya ilgi alanlarını güncelleyebilirsin.";
  }

  // Category nav
  renderCategoryNav(state.data.articles);

  // Category view
  if (state.viewByCategory && !isFiltered) {
    renderArticlesByCategory(allFiltered);
    emptyState.style.display = "none";
    articlePagination.innerHTML = "";
    return;
  }

  const gridArticles = allFiltered;
  const totalPages = Math.max(1, Math.ceil(gridArticles.length / state.pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  const pageStart = (state.currentPage - 1) * state.pageSize;
  const pageArticles = gridArticles.slice(pageStart, pageStart + state.pageSize);

  recommendedGrid.innerHTML = pageArticles.map((article) => renderArticleCardHtml(article)).join("");
  emptyState.style.display = allFiltered.length ? "none" : "block";
  renderPagination(gridArticles.length, totalPages);
  renderBookmarks();
  renderReadingInsights();
  renderPersonalizedBanner();
}

function renderArticlesByCategory(articles) {
  const preferences = normalizePreferences(state.data.preferences);
  const interests = preferences.interests;

  const grouped = {};
  for (const article of articles) {
    (grouped[article.category] = grouped[article.category] || []).push(article);
  }

  const orderedCategories = Object.keys(grouped).sort((a, b) => {
    const aScore = interests.includes(a) ? 1 : 0;
    const bScore = interests.includes(b) ? 1 : 0;
    return bScore - aScore || grouped[b].length - grouped[a].length;
  });

  if (!orderedCategories.length) {
    recommendedGrid.innerHTML = `<p class="empty-state inline">Haber bulunamadı.</p>`;
    return;
  }

  recommendedGrid.innerHTML = orderedCategories.map((category) => {
    const catArticles = grouped[category].slice(0, 3);
    const color = categoryColor(category);
    const isInterest = interests.includes(category);
    return `
      <div class="category-section" style="--cat-color: ${color}; grid-column: 1 / -1">
        <div class="category-section-header">
          <span class="cat-section-dot"></span>
          <h4>${escapeHtml(category)}${isInterest ? ' <i class="fa-solid fa-star cat-interest-star"></i>' : ""}</h4>
          <button class="cat-more-btn" data-cat-more="${escapeHtml(category)}">Tümünü gör →</button>
        </div>
        <div class="cat-articles-row">
          ${catArticles.map((a) => renderArticleCardHtml(a)).join("")}
        </div>
      </div>
    `;
  }).join("");

  renderBookmarks();
  renderReadingInsights();
  renderPersonalizedBanner();
}

function renderPagination(totalArticles, totalPages) {
  if (!articlePagination) return;
  if (!totalArticles) { articlePagination.innerHTML = ""; return; }

  const buttons = Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => `
    <button class="${page === state.currentPage ? "active" : ""}" data-page-number="${page}" aria-label="${page}. haber sayfası">${page}</button>
  `).join("");

  const start = (state.currentPage - 1) * state.pageSize + 1;
  const end = Math.min(state.currentPage * state.pageSize, totalArticles);
  articlePagination.innerHTML = `
    <span>${start}-${end} / ${totalArticles} haber</span>
    <div>
      <button data-page-number="${Math.max(1, state.currentPage - 1)}" ${state.currentPage === 1 ? "disabled" : ""}>Önceki</button>
      ${buttons}
      <button data-page-number="${Math.min(totalPages, state.currentPage + 1)}" ${state.currentPage === totalPages ? "disabled" : ""}>Sonraki</button>
    </div>
  `;
}

function renderBookmarks() {
  const bookmarks = state.data.articles.filter((a) => a.bookmarked);
  bookmarkList.innerHTML = bookmarks.map((article) => `
    <article class="bookmark-item">
      <strong>${escapeHtml(article.title)}</strong>
      <span>${escapeHtml(article.category)} · ${escapeHtml(article.source || "")} · ${escapeHtml(article.status)}</span>
    </article>
  `).join("") || `<p class="empty-state inline">Henüz kaydedilmiş haber yok.</p>`;
}

/* ============================
   POPULAR TOPICS (headlines sidebar)
   ============================ */
function getPopularTopics() {
  const significantWords = (value) => normalizeText(value)
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["haber", "son", "yeni", "icin", "için", "olan", "gore", "göre", "sonra", "once", "önce"].includes(w));

  const sim = (left, right) => {
    const ls = new Set(significantWords(left));
    const rs = new Set(significantWords(right));
    if (!ls.size || !rs.size) return 0;
    const inter = [...ls].filter((w) => rs.has(w)).length;
    return inter / new Set([...ls, ...rs]).size;
  };

  const groups = [];
  for (const article of sortArticles(state.data.articles)) {
    const text = `${article.title} ${article.summary || ""}`;
    let group = groups.find((g) => sim(g.text, text) >= 0.28);
    if (!group) { group = { text, representative: article, articles: [], sources: new Set(), score: 0 }; groups.push(group); }
    group.articles.push(article);
    if (article.source) group.sources.add(article.source);
    group.score += Number(article.relevance || 0) + (article.dateRange === "Son 24 saat" ? 8 : 0);
  }

  return groups
    .filter((g) => g.articles.length > 1 || g.sources.size > 1)
    .sort((a, b) => b.sources.size - a.sources.size || b.articles.length - a.articles.length || b.score - a.score)
    .slice(0, 5)
    .map((g, i) => ({ day: String(i + 1), month: "Sıra", id: g.representative.id, title: g.representative.title }));
}

function renderStaticLists() {
  const headlines = getPopularTopics();
  headlineList.innerHTML = headlines.length ? headlines.map((item) => `
    <article class="event-item">
      <time class="event-date">${escapeHtml(item.day)}<small>${escapeHtml(item.month)}</small></time>
      <div>
        <strong><button class="headline-link" data-action="detail" data-id="${escapeHtml(String(item.id || ""))}">${escapeHtml(item.title)}</button></strong>
      </div>
    </article>
  `).join("") : `<p class="empty-state inline">Bugün birden fazla kaynakta tekrar eden haber bulunamadı.</p>`;
}

/* ============================
   ENTITY LINKS
   ============================ */
const ENTITY_STOPWORDS = new Set([
  "Bugün", "Son", "Yeni", "Kaynak", "Haber", "AI", "RSS", "Tam", "Metin",
  "Türkiye", "Dünya", "Ekonomi", "Bilim", "Teknoloji", "Gündem", "Spor",
  "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  "Ocak", "Şubat", "Mart", "Nisan", "Pazartesi", "Salı", "Çarşamba",
  "Perşembe", "Cuma", "Cumartesi", "Pazar"
]);

const KNOWN_ENTITY_TERMS = [
  "Türkiye", "Amerika Birleşik Devletleri", "ABD", "Almanya", "Fransa", "İngiltere",
  "Rusya", "Çin", "Ukrayna", "İran", "İsrail", "Filistin", "Suriye", "Irak",
  "Yunanistan", "İtalya", "İspanya", "Hollanda", "Japonya", "Kanada", "Brezilya",
  "Meksika", "Hindistan", "Pakistan", "Suudi Arabistan", "Mısır", "Katar",
  "Birleşik Arap Emirlikleri", "BAE", "Güney Kore", "Kuzey Kore", "Avustralya",
  "Avusturya", "Belçika", "İsveç", "Norveç", "Danimarka", "Polonya", "Romanya",
  "Bulgaristan", "Gürcistan", "Azerbaycan", "Ermenistan", "Lübnan", "Ürdün",
  "Avrupa Birliği", "NATO",
  "Birleşmiş Milletler", "NASA", "UEFA", "FIFA", "TBMM", "MEB", "Merkez Bankası",
  "Adalet Bakanlığı", "İçişleri Bakanlığı", "Düzce Cumhuriyet Başsavcılığı",
  "Düzce İl Jandarma Komutanlığı", "Jandarma Genel Komutanlığı", "Emniyet Genel Müdürlüğü",
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep",
  "Kayseri", "Samsun", "Trabzon", "Diyarbakır", "Eskişehir", "Paris", "Londra",
  "Berlin", "Moskova", "Kiev", "Pekin", "Washington", "New York", "Brüksel",
  "Eurovision", "Eurovision 2026", "Dünya Kupası", "Avrupa Şampiyonası",
  "Şampiyonlar Ligi", "Süper Lig", "Olimpiyat Oyunları", "Gelinim Mutfakta",
  "Survivor", "Fenerbahçe", "Galatasaray", "Beşiktaş", "Trabzonspor",
  "Donald Trump", "Trump", "Şi Cinping", "Xi Jinping", "Elon Musk", "Musk",
  "Recep Tayyip Erdoğan", "Erdoğan", "Vladimir Putin", "Putin", "Volodimir Zelenskiy",
  "Zelenskiy", "Binyamin Netanyahu", "Netanyahu"
];

const ENTITY_DESCRIPTIONS = {
  "ABD": "Kuzey Amerika'da yer alan, 50 eyaletten oluşan federal cumhuriyet. Başkenti Washington D.C., en kalabalık şehri New York'tur. Dünyanın en büyük ekonomisine sahip olup uluslararası siyaset, teknoloji ve kültürde belirleyici bir aktördür.",
  "Amerika Birleşik Devletleri": "Kuzey Amerika'da yer alan, 50 eyaletten oluşan federal cumhuriyet. Başkenti Washington D.C.'dir. NATO'nun kurucu üyesidir ve küresel ekonomi, savunma ve teknoloji alanlarında lider konumdadır.",
  "Türkiye": "Anadolu ve Trakya topraklarında yer alan, başkenti Ankara olan parlamenter cumhuriyet. NATO üyesidir ve Avrupa ile Asya'yı bağlayan stratejik konumda bulunur. En kalabalık şehri İstanbul'dur.",
  "Almanya": "Orta Avrupa'da yer alan federal cumhuriyet. Başkenti Berlin olup Avrupa Birliği'nin en büyük ekonomisidir. Otomotiv ve mühendislik sektörlerinde küresel öncüdür.",
  "Fransa": "Batı Avrupa'da yer alan, başkenti Paris olan cumhuriyet. BM Güvenlik Konseyi daimi üyesi ve nükleer güç sahibi bir ülkedir. Avrupa Birliği'nin kurucu üyelerindendir.",
  "İngiltere": "Birleşik Krallık'ın en büyük ülkesi. Başkenti Londra olup parlamenter monarşi ile yönetilir. Endüstri Devrimi'nin doğduğu ve İngilizce'nin ana yurdu olan bir ülkedir.",
  "Rusya": "Avrupa ve Asya kıtalarına yayılan, yüzölçümü en büyük ülke. Başkenti Moskova'dır. Nükleer güç sahibi olup BM Güvenlik Konseyi daimi üyesidir.",
  "Çin": "Doğu Asya'da yer alan, dünyanın en kalabalık ülkelerinden biri. Başkenti Pekin olup dünyanın ikinci büyük ekonomisidir. Üretim ve teknolojide küresel öneme sahiptir.",
  "Ukrayna": "Doğu Avrupa'da yer alan cumhuriyet. Başkenti Kiev'dir. 2022'den bu yana Rusya ile devam eden savaş nedeniyle uluslararası gündemde geniş yer tutmaktadır.",
  "İran": "Batı Asya'da yer alan, başkenti Tahran olan İslam Cumhuriyeti. Petrol ve doğal gaz rezervleri açısından dünyanın en zengin ülkelerinden biridir.",
  "İsrail": "Orta Doğu'da Akdeniz kıyısında yer alan, başkenti Kudüs (uluslararası tanınma sınırlı) olan ülke. Teknoloji sektörü ve bölgesel çatışmalarla sık sık gündeme gelir.",
  "Filistin": "Orta Doğu'da, Batı Şeria ve Gazze Şeridi'nde varlığını sürdüren devlet. Birçok ülke tarafından tanınmakta olup İsrail ile süregelen toprak anlaşmazlığının merkezindedir.",
  "Suriye": "Orta Doğu'da yer alan, başkenti Şam olan ülke. 2011'den itibaren süren iç savaş nedeniyle bölgesel siyasette önemli bir ağırlığa sahiptir.",
  "Yunanistan": "Güneydoğu Avrupa'da yer alan, başkenti Atina olan ülke. AB ve NATO üyesi olup batı medeniyetinin doğduğu topraklar arasında sayılır.",
  "İtalya": "Güney Avrupa'da yer alan, başkenti Roma olan cumhuriyet. AB'nin kurucu üyelerindendir ve sanat, moda, otomotiv alanlarında tanınır.",
  "Hollanda": "Batı Avrupa'da yer alan, başkenti Amsterdam olan ülke. Avrupa Birliği'nin kurucu üyelerinden biri olup limanları ve tarımıyla öne çıkar.",
  "Avrupa Birliği": "Avrupa'da 27 üye devletten oluşan ekonomik ve siyasi birlik. Tek pazar, ortak para birimi (euro) ve ortak dış politika temelinde kurulmuştur.",
  "NATO": "Kuzey Atlantik Antlaşması Örgütü; 1949'da kurulan, 32 üye ülkeden oluşan kolektif savunma ittifakı. Türkiye 1952'den bu yana üyedir.",
  "Birleşmiş Milletler": "1945'te kurulan, 193 üye devletten oluşan uluslararası örgüt. Merkezi New York'tadır ve barış, güvenlik, insan hakları alanlarında çalışır.",
  "NASA": "Amerika Birleşik Devletleri'nin sivil havacılık ve uzay araştırmaları ajansı. 1958'de kurulmuş olup Apollo, Artemis ve Mars görevleriyle tanınır.",
  "UEFA": "Avrupa Futbol Federasyonları Birliği. Şampiyonlar Ligi, Avrupa Ligi ve EURO turnuvalarını düzenler. Merkezi İsviçre Nyon'dadır.",
  "FIFA": "Uluslararası Futbol Federasyonları Birliği. Dünya Kupası başta olmak üzere küresel futbol organizasyonlarını yönetir. Merkezi Zürih'tedir.",
  "TBMM": "Türkiye Büyük Millet Meclisi; Türkiye Cumhuriyeti'nin yasama organı. Ankara'da bulunur ve 600 milletvekilinden oluşur.",
  "MEB": "Milli Eğitim Bakanlığı; Türkiye'de örgün ve yaygın eğitim hizmetlerinden sorumlu bakanlık.",
  "Merkez Bankası": "Türkiye Cumhuriyet Merkez Bankası (TCMB); para politikasını yöneten, fiyat istikrarını sağlamakla görevli kurum. Merkezi Ankara'dadır.",
  "İstanbul": "Türkiye'nin en kalabalık şehri ve ekonomik merkezi. Avrupa ile Asya kıtalarına yayılan, Boğaz'la ikiye bölünen tarihi metropol.",
  "Ankara": "Türkiye'nin başkenti ve ikinci büyük şehri. Devlet kurumlarının ve büyükelçiliklerin merkezidir.",
  "İzmir": "Türkiye'nin Ege kıyısındaki üçüncü büyük şehri. Liman, fuar ve turizm açısından önemli bir merkezdir.",
  "Bursa": "Marmara Bölgesi'nde yer alan, Osmanlı'nın ilk başkentlerinden biri olan şehir. Otomotiv ve tekstil sanayisiyle tanınır.",
  "Antalya": "Akdeniz kıyısındaki turizm başkenti. Yüksek yabancı turist sayısı ve sahil otelleriyle bilinir.",
  "Adana": "Çukurova Bölgesi'nde yer alan büyükşehir. Pamuk üretimi, sanayi ve kebabıyla tanınır.",
  "Konya": "İç Anadolu'nun en büyük şehri. Mevlana ve Selçuklu mirasıyla bilinen tarım ve sanayi merkezi.",
  "Gaziantep": "Güneydoğu Anadolu'nun sanayi ve mutfak başkenti. Baklavası ve tekstil üretimiyle tanınır.",
  "Paris": "Fransa'nın başkenti ve en büyük şehri. Sanat, moda ve diplomasinin merkezlerinden biridir.",
  "Londra": "Birleşik Krallık'ın başkenti. Küresel finans merkezlerinden biri olup tarihi mimarisi ile öne çıkar.",
  "Berlin": "Almanya'nın başkenti ve en kalabalık şehri. Soğuk Savaş tarihi ve canlı kültürel hayatıyla bilinir.",
  "Moskova": "Rusya'nın başkenti ve en kalabalık şehri. Kremlin ve Kızıl Meydan'a ev sahipliği yapar.",
  "Kiev": "Ukrayna'nın başkenti. Dinyeper Nehri kıyısında kurulmuş tarihi bir Doğu Avrupa şehridir.",
  "Pekin": "Çin Halk Cumhuriyeti'nin başkenti. Yasak Şehir ve Çin Seddi'ne yakınlığıyla tanınır.",
  "Washington": "ABD'nin başkenti Washington D.C. Beyaz Saray ve Kongre binasının bulunduğu federal başkent.",
  "New York": "ABD'nin en kalabalık şehri. Wall Street ve BM Genel Merkezi'ne ev sahipliği yapar.",
  "Brüksel": "Belçika'nın başkenti ve Avrupa Birliği kurumlarının merkezi. NATO genel merkezi de buradadır.",
  "Eurovision": "Avrupa Yayın Birliği tarafından her yıl düzenlenen şarkı yarışması. Üye ülkelerin temsilcileri yarışır.",
  "Eurovision 2026": "Eurovision Şarkı Yarışması'nın 2026 yılı için planlanan organizasyonu.",
  "Dünya Kupası": "FIFA'nın dört yılda bir düzenlediği, milli takımların katıldığı en prestijli futbol turnuvası.",
  "Avrupa Şampiyonası": "UEFA EURO; dört yılda bir Avrupa milli takımları arasında düzenlenen futbol şampiyonası.",
  "Şampiyonlar Ligi": "UEFA Şampiyonlar Ligi; Avrupa'nın en iyi kulüplerinin katıldığı yıllık futbol turnuvası.",
  "Süper Lig": "Türkiye'nin en üst düzey profesyonel futbol ligi. TFF tarafından organize edilir.",
  "Olimpiyat Oyunları": "Uluslararası Olimpiyat Komitesi tarafından dört yılda bir düzenlenen çok branşlı spor organizasyonu.",
  "Fenerbahçe": "İstanbul Kadıköy merkezli, 1907'de kurulmuş çok şubeli spor kulübü. Sarı-lacivert renkleriyle tanınır.",
  "Galatasaray": "İstanbul merkezli, 1905'te kurulmuş Türkiye'nin köklü spor kulüplerinden biri. Sarı-kırmızı renkler.",
  "Beşiktaş": "İstanbul Beşiktaş ilçesinde kurulmuş, siyah-beyaz renkli köklü Türk spor kulübü.",
  "Trabzonspor": "Trabzon merkezli, 1967'de kurulmuş Türk spor kulübü. Bordo-mavi renkleriyle tanınır.",
  "Donald Trump": "ABD'li siyasetçi ve iş insanı. 2017-2021 döneminde ABD başkanlığı yaptı ve 2025'te başlayan ikinci başkanlık dönemiyle yeniden dünya gündeminde öne çıktı.",
  "Trump": "Donald Trump; ABD'li siyasetçi ve iş insanı. ABD başkanlığı ve dış politika kararlarıyla dünya gündeminde sıkça yer alır.",
  "Şi Cinping": "Çin Devlet Başkanı ve Çin Komünist Partisi Genel Sekreteri. Çin'in iç politikası, ekonomisi ve dış ilişkilerinde belirleyici konumdadır.",
  "Xi Jinping": "Çin Devlet Başkanı ve Çin Komünist Partisi Genel Sekreteri. Uluslararası haberlerde Şi Cinping adıyla da anılır.",
  "Elon Musk": "Teknoloji girişimcisi. Tesla, SpaceX, X ve yapay zeka alanındaki şirketleriyle ekonomi, teknoloji ve siyaset haberlerinde sıkça yer alır.",
  "Musk": "Elon Musk; Tesla, SpaceX ve X gibi şirketlerle teknoloji, ekonomi ve siyaset haberlerinde sıkça anılan girişimci.",
  "Recep Tayyip Erdoğan": "Türkiye Cumhurbaşkanı. Türkiye'nin iç siyaseti ve dış ilişkileriyle ilgili haberlerde öne çıkar.",
  "Erdoğan": "Recep Tayyip Erdoğan; Türkiye Cumhurbaşkanı.",
  "Vladimir Putin": "Rusya Devlet Başkanı. Rusya'nın iç politikası, dış ilişkileri ve güvenlik politikalarında belirleyici aktördür.",
  "Putin": "Vladimir Putin; Rusya Devlet Başkanı.",
  "Volodimir Zelenskiy": "Ukrayna Devlet Başkanı. Rusya-Ukrayna savaşı ve uluslararası diplomasi haberlerinde öne çıkar.",
  "Zelenskiy": "Volodimir Zelenskiy; Ukrayna Devlet Başkanı.",
  "Binyamin Netanyahu": "İsrail Başbakanı. İsrail siyaseti ve Orta Doğu gündeminde sıkça yer alır.",
  "Netanyahu": "Binyamin Netanyahu; İsrail Başbakanı."
};

function entityDescription(entity) {
  if (!entity) return "";
  if (ENTITY_DESCRIPTIONS[entity]) return ENTITY_DESCRIPTIONS[entity];
  const key = entityKey(entity);
  for (const [name, desc] of Object.entries(ENTITY_DESCRIPTIONS)) {
    if (entityKey(name) === key) return desc;
  }
  return "";
}

const PERSON_NAME_BLOCKLIST = new Set([
  "Son Dakika", "Canlı Haber", "Tam Metin", "Aynı Haber", "Kaynak Site",
  "En Yakın", "Bu Haber", "Haber Akışı", "Kişisel Gazetem"
]);

const PERSON_NAME_REJECT_WORDS = new Set([
  "Başkanı", "Başkan", "Bakanı", "Bakan", "Başbakan", "Cumhurbaşkanı",
  "Lideri", "Lider", "Sözcüsü", "Sözcü", "Genel", "Müdürü", "Direktörü",
  "Kurulu", "Partisi", "Hükümeti", "Ekibi", "Uçağı", "Ülkesi"
]);

const PERSON_TITLE_PATTERN = "(?:CHP|AK Parti|MHP|İYİ Parti|DEM Parti|Saadet Partisi|Yeniden Refah Partisi|Zafer Partisi|TİP|BBP|DSP|DP)?\\s*(?:Genel\\s+Başkanı|Eş\\s+Genel\\s+Başkanı|Cumhurbaşkanı|Başbakan|Bakanı|Bakan|Başkanı|Milletvekili|Belediye\\s+Başkanı|Valisi|Sözcüsü|Lideri|Genel\\s+Müdürü|Teknik\\s+Direktörü|Başsavcılığı|Başsavcısı)";
const INSTITUTION_PATTERN = "\\b[A-ZÇĞİÖŞÜ][\\p{L}'’.-]+(?:\\s+(?:İl|İlçe|Cumhuriyet|Büyükşehir|Belediye|Jandarma|Emniyet|Adalet|İçişleri|Dışişleri|Milli\\s+Eğitim|Sağlık|Hazine|Maliye|Ticaret|Tarım|Kültür|Turizm|Gençlik|Spor|Ulaştırma|Enerji|Çevre|Şehircilik|Başsavcılığı|Başsavcısı|Bakanlığı|Bakanlığımız|Bakanımız|Komutanlığı|Müdürlüğü|Başkanlığı|Valiliği|Kaymakamlığı|Mahkemesi|Üniversitesi)){1,5}\\b";
const EVENT_PHRASES = [
  "yasa dışı bahis şebekesi",
  "eş zamanlı operasyon",
  "sahte fatura operasyonu",
  "kara para aklama",
  "suç örgütü",
  "rüşvet operasyonu",
  "soruşturma",
  "iddianame",
  "operasyon"
];

[
  "Bugün", "Son", "Yeni", "Kaynak", "Haber", "Türkiye", "Dünya", "Ekonomi",
  "Bilim", "Teknoloji", "Gündem", "Spor", "Mayıs", "Ağustos", "Eylül",
  "Kasım", "Aralık", "Şubat", "Salı", "Çarşamba", "Perşembe"
].forEach((word) => ENTITY_STOPWORDS.add(word));

function entityKey(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function articleSearchText(article) {
  return decodeHtmlEntities(`${article.title || ""} ${article.summary || ""} ${article.fullText || ""}`);
}

function isKnownEntity(entity) {
  const key = entityKey(entity);
  return KNOWN_ENTITY_TERMS.some((term) => entityKey(term) === key);
}

function isImportantDateEntity(entity) {
  return /\b\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+\d{4}\b/u.test(entity)
    || /\b(?:19|20)\d{2}\b/.test(entity);
}

function isInstitutionEntity(entity) {
  return new RegExp(INSTITUTION_PATTERN, "u").test(entity);
}

function isImportantAmountEntity(entity) {
  return /\b\d+(?:[.,]\d+)?\s*(?:milyar|milyon|bin)\s+(?:liralık|lira|TL|dolarlık|dolar|euroluk|euro)\b/iu.test(entity);
}

function isImportantEventEntity(entity) {
  const key = entityKey(entity);
  return EVENT_PHRASES.some((phrase) => key.includes(entityKey(phrase)));
}

function isLikelyPersonName(entity) {
  const words = String(entity || "").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;
  if (PERSON_NAME_BLOCKLIST.has(entity)) return false;
  return words.every((word) => {
    const bare = word.replace(/[’'].*$/, "").replace(/[^\p{L}.-]/gu, "");
    return bare.length >= 3
      && !ENTITY_STOPWORDS.has(bare)
      && !PERSON_NAME_REJECT_WORDS.has(bare)
      && /^[A-ZÇĞİÖŞÜ]/u.test(bare)
      && !/^[A-ZÇĞİÖŞÜ]{2,}$/u.test(bare);
  });
}

function isLikelyTitledPersonName(entity) {
  const words = String(entity || "").split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 3) return false;
  return words.every((word) => {
    const bare = word.replace(/[’'].*$/, "").replace(/[^\p{L}.-]/gu, "");
    return bare.length >= 3
      && !ENTITY_STOPWORDS.has(bare)
      && !PERSON_NAME_REJECT_WORDS.has(bare)
      && /^[A-ZÇĞİÖŞÜ]/u.test(bare)
      && !/^[A-ZÇĞİÖŞÜ]{2,}$/u.test(bare);
  });
}

function stripNameSuffixes(entity) {
  return String(entity || "")
    .split(/\s+/)
    .map((word) => word.replace(/[’'].*$/, ""))
    .join(" ")
    .trim();
}

function extractEntitiesFromText(text) {
  const clean = decodeHtmlEntities(text).replace(/\s+/g, " ");
  const cleanKey = entityKey(clean);
  const entities = new Map();

  for (const term of KNOWN_ENTITY_TERMS) {
    if (cleanKey.includes(entityKey(term))) entities.set(entityKey(term), term);
  }

  for (const match of clean.matchAll(/\b\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+\d{4}\b/gu)) {
    entities.set(entityKey(match[0]), match[0]);
  }

  for (const match of clean.matchAll(/\b(?:19|20)\d{2}\b/g)) {
    const year = match[0];
    const around = clean.slice(Math.max(0, match.index - 32), match.index + 36);
    if (/seçim|deprem|kriz|savaş|final|eurovision|olimpiyat|kupa|şampiyona/i.test(around)) {
      entities.set(entityKey(year), year);
    }
  }

  for (const match of clean.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:milyar|milyon|bin)\s+(?:liralık|lira|TL|dolarlık|dolar|euroluk|euro)\b/giu)) {
    entities.set(entityKey(match[0]), match[0]);
  }

  for (const phrase of EVENT_PHRASES) {
    const phraseKey = entityKey(phrase);
    if (cleanKey.includes(phraseKey)) {
      const found = clean.match(new RegExp(phrase.replace(/\s+/g, "\\s+"), "i"))?.[0] || phrase;
      entities.set(entityKey(found), found);
    }
  }

  for (const match of clean.matchAll(new RegExp(INSTITUTION_PATTERN, "gu"))) {
    const value = match[0].replace(/[,:;.!?]+$/g, "").trim();
    if (value.split(/\s+/).length < 2) continue;
    entities.set(entityKey(value), value);
  }

  const titledNameRegex = new RegExp(`\\b${PERSON_TITLE_PATTERN}\\s+([A-ZÇĞİÖŞÜ][\\p{L}'’.-]{2,}(?:\\s+[A-ZÇĞİÖŞÜ][\\p{L}'’.-]{2,}){0,2})`, "gu");
  for (const match of clean.matchAll(titledNameRegex)) {
    const value = stripNameSuffixes(match[1].replace(/[,:;.!?]+$/g, "").trim());
    if (!isLikelyTitledPersonName(value)) continue;
    entities.set(entityKey(value), value);
  }

  for (const match of clean.matchAll(/\b[A-ZÇĞİÖŞÜ][\p{L}'’.-]{2,}\s+[A-ZÇĞİÖŞÜ][\p{L}'’.-]{2,}(?:\s+[A-ZÇĞİÖŞÜ][\p{L}'’.-]{2,})?\b/gu)) {
    const value = stripNameSuffixes(match[0].replace(/[,:;.!?]+$/g, "").trim());
    if (!isLikelyPersonName(value)) continue;
    entities.set(entityKey(value), value);
  }

  for (const match of clean.matchAll(/\b[A-ZÇĞİÖŞÜ]{2,}(?:\s+\d{2,4})?\b/gu)) {
    const value = match[0].trim();
    if (value.length >= 3) entities.set(entityKey(value), value);
  }

  return [...entities.values()];
}

function getArticleEntities(article) {
  const baseEntities = extractEntitiesFromText(`${article.title || ""} ${article.summary || ""} ${article.fullText || ""}`);
  const articleText = entityKey(articleSearchText(article));
  return baseEntities
    .map((entity) => ({
      entity,
      count: state.data.articles.filter((item) => entityKey(articleSearchText(item)).includes(entityKey(entity))).length
    }))
    .filter((item) => item.count > 0 && articleText.includes(entityKey(item.entity)))
    .filter((item) => isKnownEntity(item.entity)
      || isImportantDateEntity(item.entity)
      || isImportantAmountEntity(item.entity)
      || isImportantEventEntity(item.entity)
      || isInstitutionEntity(item.entity)
      || isLikelyPersonName(item.entity)
      || isLikelyTitledPersonName(item.entity))
    .sort((a, b) => b.entity.length - a.entity.length)
    .slice(0, 28)
    .map((item) => item.entity);
}

function relatedArticlesForEntity(entity) {
  const key = entityKey(entity);
  if (!key) return [];
  return sortArticles(state.data.articles.filter((article) => entityKey(articleSearchText(article)).includes(key)));
}

function getEntityInfo(entity) {
  const related = relatedArticlesForEntity(entity);
  const categories = [...new Set(related.map((article) => article.category).filter(Boolean))].slice(0, 4);
  const sources = [...new Set(related.map((article) => article.source).filter(Boolean))].slice(0, 4);
  const description = state.entityInfoCache[entityKey(entity)] || entityDescription(entity);
  const tooltip = description
    || (related[0] ? trimSummary(related[0].summary || related[0].fullText || related[0].title) : `${entity}`);
  return { related, categories, sources, description, tooltip };
}

function renderEntitySummary(entity, info, loading = false) {
  if (!topicSummary) return;
  const descriptionHtml = info.description
    ? `<p>${escapeHtml(info.description)}</p>`
    : `<p>${escapeHtml(entity)} hakkında bilgi hazırlanıyor. Aşağıdaki haberlerden güncel bağlamı inceleyebilirsin.</p>`;
  topicSummary.innerHTML = `
    <div>
      <span class="topic-kicker">Bilgi kartı${loading ? " hazırlanıyor" : ""}</span>
      ${descriptionHtml}
    </div>
    <div class="topic-facts">
      <span>${escapeHtml(info.categories.join(", ") || "Kategori bilgisi yok")}</span>
      <span>${escapeHtml(info.sources.join(", ") || "Kaynak bilgisi yok")}</span>
    </div>
  `;
}

async function loadAiEntityInfo(entity) {
  const key = entityKey(entity);
  if (!key || state.entityInfoCache[key]) return;
  const related = relatedArticlesForEntity(entity).slice(0, 5);
  try {
    const payload = await api("/api/entities/info", {
      method: "POST",
      body: JSON.stringify({
        entity,
        relatedArticles: related.map((article) => ({
          title: article.title,
          summary: article.summary,
          category: article.category,
          source: article.source
        }))
      })
    });
    const description = String(payload.description || "").trim();
    if (!description) return;
    state.entityInfoCache[key] = description;
    if (state.activeEntity === entity) {
      renderEntitySummary(entity, getEntityInfo(entity));
    }
  } catch (error) {
    if (state.activeEntity === entity && !entityDescription(entity)) {
      showToast(`Bilgi kartı AI ile hazırlanamadı: ${error.message}`, "error");
    }
  }
}

function annotateTextWithEntities(text, entities) {
  const source = String(text || "");
  if (!source.trim()) return "";
  const sorted = [...entities].sort((a, b) => b.length - a.length);
  const linkedEntities = new Set();
  let html = "";
  let index = 0;
  while (index < source.length) {
    const match = sorted.find((entity) => {
      if (linkedEntities.has(entityKey(entity))) return false;
      if (!source.startsWith(entity, index)) return false;
      const before = source[index - 1] || "";
      const after = source[index + entity.length] || "";
      return !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after);
    });
    if (!match) {
      html += escapeHtml(source[index]);
      index += 1;
      continue;
    }
    const info = getEntityInfo(match);
    html += `<button class="entity-link" type="button" data-entity="${escapeHtml(match)}" data-tooltip="${escapeHtml(info.tooltip)}">${escapeHtml(match)}</button>`;
    linkedEntities.add(entityKey(match));
    index += match.length;
  }
  return html;
}

function renderAnnotatedBody(article) {
  const entities = getArticleEntities(article);
  const raw = decodeHtmlEntities(article.fullText || article.summary || "");
  return raw.split(/\n{2,}/).map((paragraph) => `
    <p>${annotateTextWithEntities(paragraph, entities)}</p>
  `).join("");
}

async function openEntityPage(entity) {
  const info = getEntityInfo(entity);
  state.entityReturn = {
    page: state.activePage,
    articleId: detailPanel && !detailPanel.hidden ? state.openArticleId : null
  };
  state.activeEntity = entity;
  if (detailPanel) detailPanel.hidden = true;
  if (profileDetail?.hidden) document.body.classList.remove("reader-open");
  if (topicTitle) topicTitle.textContent = entity;
  renderEntitySummary(entity, info, !state.entityInfoCache[entityKey(entity)]);
  if (topicRelated) {
    topicRelated.innerHTML = info.related.length
      ? `
        <div class="topic-related-heading">
          <h4>${escapeHtml(entity)} ile ilgili haberler</h4>
          <span>${info.related.length} haber</span>
        </div>
        <div class="article-grid">
          ${info.related.slice(0, 12).map((article) => renderArticleCardHtml(article)).join("")}
        </div>
      `
      : `<p class="empty-state inline">Bu konuya bağlı haber bulunamadı.</p>`;
  }
  showPage("topic");
  await loadAiEntityInfo(entity);
}

/* ============================
   ARTICLE DETAIL
   ============================ */
async function showDetail(articleId) {
  let article = state.data.articles.find((item) => String(item.id) === String(articleId));
  let duplicates = [];
  if (state.usingApi) {
    try {
      const payload = await api(`/api/articles/${articleId}`);
      article = toUiArticle(payload.article);
      duplicates = payload.article.duplicates || [];
    } catch {}
  }
  if (!article) return;

  detailPanel.hidden = false;
  document.body.classList.add("reader-open");
  state.openArticleId = article.id;
  const color = categoryColor(article.category);
  detailContent.innerHTML = `
    ${article.imageUrl ? `<img class="detail-image" src="${escapeHtml(article.imageUrl)}" alt="">` : ""}
    <div class="article-meta">
      <span class="cat-badge" style="--cat-color:${color};background:${color}">${escapeHtml(article.category)}</span>
      <span>${escapeHtml(article.source || "")}</span>
      <span>${escapeHtml(article.date || "")}</span>
      <span>${escapeHtml(article.readTime || "")}</span>
    </div>
    <h2>${escapeHtml(article.title)}</h2>
    <div class="ai-summary">
      <strong><i class="fa-solid fa-wand-magic-sparkles"></i> AI Özeti</strong>
      <p>${escapeHtml(article.aiSummary || article.summary)}</p>
    </div>
    ${article.contentStatus === "summary_only" ? `
      <div class="content-warning">
        <strong>Tam metin bu RSS kaynağında verilmedi</strong>
        <p>Bu kaynak RSS içinde yalnızca özet paylaşıyor. Tam metin için kaynak siteye gidin.</p>
      </div>
    ` : ""}
    <div class="article-body">
      ${renderAnnotatedBody(article)}
    </div>
    ${duplicates.length ? `
      <div class="duplicate-box">
        <strong><i class="fa-solid fa-copy"></i> Aynı haber başka kaynaklarda</strong>
        ${duplicates.map((item) => `
          <a class="duplicate-link" href="${escapeHtml(item.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">
            ${sourceLogoUrl(item.sourceUrl) ? `<img src="${escapeHtml(sourceLogoUrl(item.sourceUrl))}" alt="">` : `<i class="fa-regular fa-newspaper"></i>`}
            <span>
              <strong>${escapeHtml(item.sourceName || "")}</strong>
              <small>${escapeHtml(item.title)}</small>
            </span>
          </a>
        `).join("")}
      </div>
    ` : ""}
    <p class="source-disclaimer">Kaynak: <a href="${escapeHtml(article.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.sourceUrl || article.source || "")}</a></p>
  `;
  markArticleAsRead(article);
}

/* ============================
   FILTER HELPERS
   ============================ */
function resetFilters() {
  searchInput.value = "";
  categoryFilter.value = "Tümü";
  sourceFilter.value = "Tümü";
  statusFilter.value = "Tümü";
  dateFilter.value = "Tümü";
  sortFilter.value = "relevance";
  state.favoriteFeedOnly = false;
  const favoriteButton = document.querySelector("#favorite-feed");
  favoriteButton?.classList.remove("active");
  if (favoriteButton) favoriteButton.innerHTML = `<i class="fa-solid fa-star"></i> Favori Akışın`;
  state.currentPage = 1;
  renderArticles();
  updatePrintPreview();
}

function currentSearchFilters() {
  return {
    query: searchInput.value.trim(),
    category: categoryFilter.value,
    source: sourceFilter.value,
    status: statusFilter.value,
    date: dateFilter.value,
    sort: sortFilter.value
  };
}

function applySearchFilters(filters) {
  searchInput.value = filters.query || "";
  categoryFilter.value = filters.category || "Tümü";
  sourceFilter.value = filters.source || "Tümü";
  statusFilter.value = filters.status || "Tümü";
  dateFilter.value = filters.date || "Tümü";
  sortFilter.value = filters.sort || "relevance";
  state.currentPage = 1;
  renderArticles();
  updatePrintPreview();
}

/* ============================
   SAVED SEARCHES
   ============================ */
async function loadSavedSearches() {
  if (!state.usingApi) { savedSearchList.innerHTML = ""; return; }
  try {
    const payload = await api("/api/searches");
    renderSavedSearches(payload.searches || []);
  } catch {
    savedSearchList.innerHTML = `<p class="empty-state inline">Kayıtlı aramalar yüklenemedi.</p>`;
  }
}

function renderSavedSearches(searches) {
  state.savedSearches = searches;
  savedSearchList.innerHTML = searches.length ? searches.map((item) => `
    <article class="saved-search-item">
      <button data-search-action="apply" data-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
      <span>${escapeHtml(item.filters.query || "Tüm haberler")} · ${escapeHtml(item.filters.category)} · ${escapeHtml(item.filters.sort)}</span>
      <button data-search-action="delete" data-id="${escapeHtml(item.id)}" aria-label="Kayıtlı aramayı sil">Sil</button>
    </article>
  `).join("") : `<p class="empty-state inline">Kayıtlı arama yok.</p>`;
}

async function saveCurrentSearch() {
  const filters = currentSearchFilters();
  const label = filters.query || `${filters.category} / ${filters.source}`;
  try {
    if (!state.usingApi) throw new Error("Kayıt için server gerekli.");
    await api("/api/searches", { method: "POST", body: JSON.stringify({ label, filters }) });
    await loadSavedSearches();
    showToast("Arama kaydedildi.", "success");
  } catch (error) {
    showToast(`Arama kaydedilemedi: ${error.message}`, "error");
  }
}

async function handleSavedSearchAction(action, searchId) {
  if (action === "apply") {
    const search = state.savedSearches.find((s) => s.id === searchId);
    if (!search) return;
    applySearchFilters(search.filters);
    return;
  }
  if (action === "delete") {
    try {
      await api(`/api/searches/${searchId}`, { method: "DELETE" });
      await loadSavedSearches();
      showToast("Arama silindi.", "info");
    } catch (error) {
      showToast(`Arama silinemedi: ${error.message}`, "error");
    }
  }
}

/* ============================
   READ / BOOKMARK TRACKING
   ============================ */
async function markArticleAsRead(article) {
  if (!article || article.status === "Okundu") return;
  const local = state.data.articles.find((item) => String(item.id) === String(article.id));
  const previous = article.status;
  article.status = "Okundu";
  if (local) local.status = "Okundu";
  try {
    if (state.usingApi) {
      await api(`/api/articles/${article.id}/read`, { method: "POST", body: JSON.stringify({ status: "read" }) });
      await loadBackendData();
    }
  } catch (error) {
    article.status = previous;
    if (local) local.status = previous;
  }
  renderArticles();
  renderReadingInsights();
}

function findArticleForAction(id) {
  if (id) {
    const byId = state.data.articles.find((item) => String(item.id) === String(id));
    if (byId) return byId;
  }
  const liveItem = state.data.last24[state.liveIndex];
  const matched = state.data.articles.find((item) => item.title === liveItem?.title && item.source === liveItem?.source);
  if (matched) return matched;
  if (!liveItem) return null;

  const liveArticle = {
    id: liveItem.id || `live_${state.liveIndex + 1}`,
    category: liveItem.category || "Gündem",
    title: liveItem.title,
    summary: liveItem.summary || "",
    fullText: liveItem.summary || "",
    source: liveItem.source || "",
    date: liveItem.time || new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
    dateRange: "Son 24 saat",
    readTime: "3 dk",
    relevance: 80,
    status: "Okunmadı",
    bookmarked: Boolean(liveItem.bookmarked)
  };
  liveItem.id = liveArticle.id;
  state.data.articles.unshift(liveArticle);
  return liveArticle;
}

async function handleArticleAction(action, article) {
  if (!article) return;

  if (action === "detail") { showDetail(article.id); return; }

  if (action === "bookmark") {
    const previous = article.bookmarked;
    article.bookmarked = !article.bookmarked;
    try {
      if (state.usingApi) await api(`/api/articles/${article.id}/bookmark`, { method: "POST", body: "{}" });
      state.data.last24
        .filter((item) => String(item.id) === String(article.id) || (item.title === article.title && item.source === article.source))
        .forEach((item) => { item.id = article.id; item.bookmarked = article.bookmarked; });
      showToast(article.bookmarked ? "Haber kaydedildi." : "Kaydedilenlerden çıkarıldı.", article.bookmarked ? "success" : "info");
    } catch (error) {
      article.bookmarked = previous;
      showToast(`Kaydetme başarısız: ${error.message}`, "error");
    }
    renderReadingInsights();
  }

  if (action === "read") {
    const previous = article.status;
    article.status = article.status === "Okundu" ? "Okunmadı" : "Okundu";
    try {
      if (state.usingApi) {
        await api(`/api/articles/${article.id}/read`, {
          method: "POST",
          body: JSON.stringify({ status: article.status === "Okundu" ? "read" : "unread" })
        });
        await loadBackendData();
      }
      showToast(article.status === "Okundu" ? "Okundu işaretlendi." : "Okunmadı işaretlendi.", "success");
    } catch (error) {
      article.status = previous;
      showToast(`Durum güncellenemedi: ${error.message}`, "error");
    }
    renderReadingInsights();
  }

  if (action === "newspaper") {
    const id = String(article.id);
    if (state.newspaperArticles.includes(id)) {
      state.newspaperArticles = state.newspaperArticles.filter((item) => item !== id);
      showToast("Gazeteden çıkarıldı.", "info");
    } else {
      state.newspaperArticles.push(id);
      showToast("Gazeteye eklendi.", "success");
    }
    renderExportArticleOptions();
    renderReadingInsights();
  }

  renderArticles();
  renderLiveNews();
}

/* ============================
   PROFILE PANEL
   ============================ */
function openProfileDetail() {
  if (!profileDetail) return;
  profileDetail.hidden = false;
  document.body.classList.add("reader-open");
  profileNameInput?.focus();
}

function closeProfileDetail() {
  if (!profileDetail) return;
  profileDetail.hidden = true;
  if (detailPanel?.hidden) document.body.classList.remove("reader-open");
}

/* ============================
   ONBOARDING / AUTH HANDLERS
   ============================ */
function getOnboardingFormValues() {
  const interests = [...onboardingForm.querySelectorAll("input[name='interest']:checked")].map((i) => i.value);
  const readingTimes = [...onboardingForm.querySelectorAll("input[name='readingTime']:checked")].map((i) => i.value);
  const contentDepth = onboardingForm.querySelector("input[name='contentDepth']:checked")?.value || "mixed";
  const readingGoal = Math.max(1, Number(onboardingGoal.value || 10));
  return { interests, readingTimes, contentDepth, readingGoal };
}

function updateOnboardingButtonState() {
  const { interests } = getOnboardingFormValues();
  const submitBtn = document.getElementById("onboarding-submit");
  const counter = document.getElementById("onboarding-interest-counter");
  if (counter) {
    counter.textContent = `${interests.length}/3`;
    counter.classList.toggle("is-complete", interests.length >= 3);
  }
  if (submitBtn) {
    if (interests.length < 3) {
      submitBtn.disabled = true;
      submitBtn.textContent = `En az 3 konu seç (${interests.length}/3)`;
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = pendingRegister
        ? "Hesabı Oluştur ve Akışı Başlat"
        : "Akışımı Başlat";
    }
  }
}

async function completeOnboarding(event) {
  event.preventDefault();
  const { interests, readingTimes, contentDepth, readingGoal } = getOnboardingFormValues();
  if (interests.length < 3) { authStatus.textContent = "En az 3 ilgi alanı seç."; return; }
  const selectedPreferences = normalizePreferences({ interests, readingTimes, contentDepth, readingGoal, language: "tr" });

  authStatus.textContent = pendingRegister ? "Hesabın oluşturuluyor..." : "Akış hazırlanıyor...";
  try {
    if (pendingRegister) {
      // Combined registration: account is only created when onboarding is completed.
      const payload = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: pendingRegister.username,
          email: usernameToEmail(pendingRegister.username),
          password: pendingRegister.password,
          interests: selectedPreferences.interests,
          readingGoal: selectedPreferences.readingGoal,
          readingTimes: selectedPreferences.readingTimes,
          contentDepth: selectedPreferences.contentDepth
        })
      });
      setAuthSession(payload, pendingRegister.username);
      // Send extended preferences as well to be safe.
      await api("/api/profile/preferences", {
        method: "PUT",
        body: JSON.stringify(selectedPreferences)
      });
      pendingRegister = null;
    } else {
      // Existing user completing onboarding.
      const profile = await api("/api/profile").catch(() => ({ user: state.authUser, preferences: {} }));
      const preferences = normalizePreferences({
        ...profile.preferences,
        interests: selectedPreferences.interests,
        readingGoal: selectedPreferences.readingGoal,
        readingTimes: selectedPreferences.readingTimes,
        contentDepth: selectedPreferences.contentDepth,
        language: "tr"
      });
      await api("/api/profile/preferences", { method: "PUT", body: JSON.stringify(preferences) });
      state.data.preferences = preferences;
    }
    state.data.preferences = selectedPreferences;

    localStorage.setItem(onboardingKey(state.authUser?.name), "1");
    authOverlay.hidden = true;
    await initAppData();
  } catch (error) {
    authStatus.textContent = `İşlem başarısız: ${error.message}`;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  authStatus.textContent = "Giriş yapılıyor...";
  const username = loginUsername.value.trim();
  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: usernameToEmail(username), password: loginPassword.value })
    });
    setAuthSession(payload, username);
    pendingRegister = null;
    if (localStorage.getItem(onboardingKey(username))) {
      authOverlay.hidden = true;
      await initAppData();
    } else {
      authStatus.textContent = "Önce haber tercihlerini seç.";
      showAuthStep("onboarding");
      updateOnboardingButtonState();
    }
  } catch (error) {
    authStatus.textContent = `Giriş başarısız: ${error.message}`;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const username = registerUsername.value.trim();
  if (!username) { authStatus.textContent = "Kullanıcı adı zorunlu."; return; }
  if (registerPassword.value.length < 4) { authStatus.textContent = "Şifre en az 4 karakter olmalı."; return; }
  if (registerPassword.value !== registerPasswordRepeat.value) {
    authStatus.textContent = "Şifreler eşleşmiyor.";
    return;
  }
  // No API call yet. The account is only created after the user completes onboarding.
  pendingRegister = { username, password: registerPassword.value };
  authStatus.textContent = "İyi gidiyor. Şimdi tercihlerini seç.";
  showAuthStep("onboarding");
  const backBtn = document.getElementById("onboarding-back");
  if (backBtn) backBtn.hidden = false;
  updateOnboardingButtonState();
}

/* ============================
   EVENT LISTENERS
   ============================ */

// Edition tabs (new nav system)
document.querySelectorAll(".etab[data-page]").forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// Legacy section-list (JS compat, hidden)
document.querySelectorAll(".section-list a[data-page]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(link.dataset.page);
  });
});

// Filter controls
[searchInput, categoryFilter, sourceFilter, statusFilter, dateFilter, sortFilter].forEach((control) => {
  control.addEventListener("input", () => { state.currentPage = 1; renderArticles(); });
  control.addEventListener("change", () => { state.currentPage = 1; renderArticles(); });
});

// Category nav (sidebar)
document.getElementById("category-nav-list")?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-cat-filter]");
  if (!btn) return;
  categoryFilter.value = btn.dataset.catFilter;
  state.currentPage = 1;
  renderArticles();
  showPage("feed");
});

[eventCityFilter, eventTypeFilter].forEach((control) => {
  control?.addEventListener("change", async () => {
    state.eventFilters.city = eventCityFilter?.value || "ISTANBUL";
    state.eventFilters.type = eventTypeFilter?.value || "Tümü";
    briefList.innerHTML = `<p class="empty-state inline">Biletix etkinlikleri yükleniyor...</p>`;
    await loadEvents();
    renderEvents();
    renderNotifications();
  });
});

// Interest cloud (sidebar)
document.getElementById("interest-cloud-sidebar")?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-cat-interest]");
  if (!btn) return;
  categoryFilter.value = btn.dataset.catInterest;
  state.currentPage = 1;
  renderArticles();
  showPage("feed");
});

// View toggle (category / normal)
document.getElementById("toggle-category-view")?.addEventListener("click", (event) => {
  state.viewByCategory = !state.viewByCategory;
  const toggleBtn = event.currentTarget;
  toggleBtn.classList.toggle("active", state.viewByCategory);
  toggleBtn.innerHTML = state.viewByCategory
    ? `<i class="fa-solid fa-list"></i> Normal Görünüm`
    : `<i class="fa-solid fa-layer-group"></i> Kategorilere Göre`;
  state.currentPage = 1;
  renderArticles();
});

// "Cat more" button inside category section view
recommendedGrid.addEventListener("click", async (event) => {
  const moreBtn = event.target.closest("button[data-cat-more]");
  if (moreBtn) {
    categoryFilter.value = moreBtn.dataset.catMore;
    state.viewByCategory = false;
    state.currentPage = 1;
    const toggleBtn = document.getElementById("toggle-category-view");
    if (toggleBtn) {
      toggleBtn.classList.remove("active");
      toggleBtn.innerHTML = `<i class="fa-solid fa-layer-group"></i> Kategorilere Göre`;
    }
    renderArticles();
    return;
  }
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  await handleArticleAction(btn.dataset.action, findArticleForAction(btn.dataset.id));
});

topicRelated?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  await handleArticleAction(btn.dataset.action, findArticleForAction(btn.dataset.id));
});

topicBack?.addEventListener("click", () => {
  const ret = state.entityReturn;
  state.entityReturn = null;
  const returnPage = ret?.page && ret.page !== "topic" ? ret.page : "feed";
  showPage(returnPage);
  if (ret?.articleId) {
    showDetail(ret.articleId);
  }
});

// Pagination
articlePagination?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-page-number]");
  if (!btn || btn.disabled) return;
  state.currentPage = Number(btn.dataset.pageNumber);
  renderArticles();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Sort
document.querySelector("#sort-relevance")?.addEventListener("click", () => {
  sortFilter.value = "relevance";
  state.data.articles.sort((a, b) => b.relevance - a.relevance);
  renderArticles();
});

document.querySelector("#favorite-feed")?.addEventListener("click", (event) => {
  state.favoriteFeedOnly = !state.favoriteFeedOnly;
  event.currentTarget.classList.toggle("active", state.favoriteFeedOnly);
  event.currentTarget.innerHTML = state.favoriteFeedOnly
    ? `<i class="fa-solid fa-star"></i> Favori Akışın (%75+)`
    : `<i class="fa-solid fa-star"></i> Favori Akışın`;
  state.currentPage = 1;
  renderArticles();
  showPage("feed");
});

// Clear filters
document.querySelector("#clear-filters")?.addEventListener("click", resetFilters);

// Save search
saveSearchButton?.addEventListener("click", saveCurrentSearch);

// Saved search list
savedSearchList?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-search-action]");
  if (!btn) return;
  await handleSavedSearchAction(btn.dataset.searchAction, btn.dataset.id);
});

// Integration buttons
document.querySelector("#refresh-integrations")?.addEventListener("click", refreshIntegrations);
document.querySelector("#test-news-api")?.addEventListener("click", testNewsApi);
document.querySelector("#test-ai-api")?.addEventListener("click", testAiApi);

// Profile
profileForm?.addEventListener("submit", saveProfile);
resetPreferencesButton?.addEventListener("click", resetProfilePreferences);
logoutButton?.addEventListener("click", logout);
openProfileButton?.addEventListener("click", openProfileDetail);
closeProfileButton?.addEventListener("click", closeProfileDetail);
profileBackdrop?.addEventListener("click", closeProfileDetail);
profileNameInput?.addEventListener("input", () => {
  updateProfileChip(profileNameInput.value);
});
newspaperTitleMode?.addEventListener("change", () => {
  localStorage.setItem(NEWSPAPER_TITLE_MODE_KEY, newspaperTitleMode.value);
  updateNewspaperTitle(profileNameInput?.value || state.authUser?.name);
});
profileAvatarInput?.addEventListener("change", () => {
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    profileStatus.textContent = "Lütfen bir görsel dosyası seç.";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(PROFILE_AVATAR_KEY, String(reader.result));
    updateProfileChip(profileNameInput?.value || state.authUser?.name);
    profileStatus.textContent = "Profil resmi güncellendi.";
    showToast("Profil resmi güncellendi.", "success");
  };
  reader.readAsDataURL(file);
});
openNotificationsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleNotifications();
});
notificationPopover?.addEventListener("click", (event) => {
  event.stopPropagation();
  const item = event.target.closest("[data-notification-id]");
  if (!item) return;
  const id = item.dataset.notificationId;
  setStoredReadNotifications([...getStoredReadNotifications(), id]);
  renderNotifications();

  if (id.startsWith("personal:")) {
    const parts = id.split(":");
    const dayKey = parts[1];
    selectedCalendarDay = dayKey;
    showPage("calendar");
    renderEditionCalendar();
  } else if (id.startsWith("event:")) {
    showPage("events");
  }
  
  toggleNotifications(false);
});
markNotificationsReadButton?.addEventListener("click", () => {
  setStoredReadNotifications(getNotificationItems().map((item) => item.id));
  renderNotifications();
  showToast("Bildirimler okundu.", "success");
});
editionCalendarPopover?.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-calendar-day]");
  if (!dayButton) return;
  selectedCalendarDay = dayButton.dataset.calendarDay;
  renderEditionCalendar();
});
calendarSaveNoteButton?.addEventListener("click", () => {
  if (!selectedCalendarDay) selectedCalendarDay = dateKey(new Date());
  const note = calendarNoteInput?.value.trim();
  const time = calendarTimeInput?.value;
  if (!note || !time) {
    showToast("Lütfen hem saat hem de hatırlatıcı metni girin.", "error");
    return;
  }
  const data = getCalendarPersonalization();
  const current = data[selectedCalendarDay] || {};
  const reminders = Array.isArray(current.reminders) ? current.reminders : [];
  reminders.push({ time, note });
  
  data[selectedCalendarDay] = {
    ...current,
    reminders
  };
  saveCalendarPersonalization(data);
  renderEditionCalendar();
  showToast("Hatırlatıcı başarıyla eklendi.", "success");
});
document.addEventListener("click", () => toggleNotifications(false));

// Dark mode live preview
darkModeToggle?.addEventListener("change", () => {
  applyReadabilityPreferences(normalizePreferences({
    darkMode: darkModeToggle.checked,
    fontScale: Number(fontSizeRange.value),
    notifications: notificationToggle?.checked,
    language: profileLanguage?.value,
    readingGoal: Number(readingGoalInput?.value),
    interests: [...interestList.querySelectorAll("input[type='checkbox']:checked")].map((i) => i.value)
  }));
});
fontSizeRange?.addEventListener("input", () => {
  const preferences = normalizePreferences({
    ...state.data.preferences,
    fontScale: Number(fontSizeRange.value)
  });
  state.data.preferences = preferences;
  applyReadabilityPreferences(preferences);
});

// Auth forms
loginForm?.addEventListener("submit", handleLogin);
registerForm?.addEventListener("submit", handleRegister);
onboardingForm?.addEventListener("submit", completeOnboarding);
onboardingForm?.addEventListener("change", updateOnboardingButtonState);
onboardingForm?.addEventListener("input", updateOnboardingButtonState);

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    button.setAttribute("aria-label", showPassword ? "Şifreyi gizle" : "Şifreyi göster");
    button.innerHTML = showPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
  });
});

const moodButton = document.querySelector(".mood-button");
const moodOptions = document.querySelector("#mood-options");
const moodSelect = document.querySelector("#mood-select");
const moodCurrent = document.querySelector("#mood-current");

moodButton?.addEventListener("click", () => {
  const isOpen = !moodOptions.hidden;
  moodOptions.hidden = isOpen;
  moodButton.setAttribute("aria-expanded", String(!isOpen));
});

moodOptions?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-mood-value]");
  if (!option) return;
  const value = option.dataset.moodValue;
  if (moodCurrent) moodCurrent.textContent = value;
  if (moodSelect) moodSelect.value = value;
  moodOptions.hidden = true;
  moodButton?.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", (event) => {
  if (!moodOptions || moodOptions.hidden) return;
  if (event.target.closest(".mood-selector")) return;
  moodOptions.hidden = true;
  moodButton?.setAttribute("aria-expanded", "false");
});

// "Back" button in onboarding (return to register form)
document.getElementById("onboarding-back")?.addEventListener("click", () => {
  showAuthStep("register");
  authStatus.textContent = "";
});

// Auth tab buttons reset pending register flow
document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    authStatus.textContent = "";
    // Cancel any half-completed register if user switches tab
    if (btn.dataset.authTab !== "onboarding") {
      pendingRegister = null;
      const backBtn = document.getElementById("onboarding-back");
      if (backBtn) backBtn.hidden = true;
    }
    showAuthStep(btn.dataset.authTab);
  });
});

// Article detail close
detailContent?.addEventListener("click", (event) => {
  const entityButton = event.target.closest("button[data-entity]");
  if (!entityButton) return;
  openEntityPage(entityButton.dataset.entity);
});

document.querySelector("#close-detail")?.addEventListener("click", () => {
  detailPanel.hidden = true;
  state.openArticleId = null;
  if (profileDetail?.hidden) document.body.classList.remove("reader-open");
});
readerBackdrop?.addEventListener("click", () => {
  detailPanel.hidden = true;
  state.openArticleId = null;
  if (profileDetail?.hidden) document.body.classList.remove("reader-open");
});

// Live news
liveNewsCard?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  await handleArticleAction(btn.dataset.action, findArticleForAction(btn.dataset.id));
});
liveNewsDots?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-index]");
  if (!btn) return;
  state.liveIndex = Number(btn.dataset.index);
  startLiveNews();
});

// Headlines sidebar
headlineList?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  await handleArticleAction(btn.dataset.action, findArticleForAction(btn.dataset.id));
});

// Events
briefList?.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-event-action]");
  if (!btn) return;
  await handleEventAction(btn.dataset.eventAction, btn.dataset.id);
});

// Export
printEditionButton?.addEventListener("click", openPrintPreview);
downloadPdfButton?.addEventListener("click", downloadPdf);
document.querySelectorAll("input[name='layout']").forEach((input) => {
  input.addEventListener("change", updatePrintPreview);
});
exportArticleList?.addEventListener("change", updatePrintPreview);
exportArticleList?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-remove-newspaper]");
  if (!btn) return;
  state.newspaperArticles = state.newspaperArticles.filter((id) => id !== String(btn.dataset.removeNewspaper));
  renderExportArticleOptions();
  renderArticles();
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (profileDetail && !profileDetail.hidden) { closeProfileDetail(); return; }
  if (!detailPanel.hidden) { detailPanel.hidden = true; document.body.classList.remove("reader-open"); }
});

/* ============================
   INITIALIZATION
   ============================ */
async function initAppData() {
  await loadBackendData();
  await loadProfile();
  await loadEvents();
  await loadSavedSearches();
  populateFilters();
  renderStaticLists();
  renderEvents();
  renderArticles();
  renderExportArticleOptions();
  startLiveNews();
  refreshIntegrations();
  updateEditionStrip();
  renderEditionCalendar();
  renderInterestCloud();
  renderPersonaChips();
  applyReadingTimeBanner();
  renderPersonalizedBanner();
  renderNotifications();
  showPage("feed");
}

async function init() {
  if (!state.authToken) {
    showAuthStep("register");
    authOverlay.hidden = false;
    return;
  }
  if (!localStorage.getItem(onboardingKey(state.authUser?.name))) {
    showAuthStep("onboarding");
    authOverlay.hidden = false;
    updateOnboardingButtonState();
    return;
  }
  authOverlay.hidden = true;
  await initAppData();
}

// Initialize counters/state on form ready
document.addEventListener("DOMContentLoaded", () => {
  updateOnboardingButtonState();
});

init();
