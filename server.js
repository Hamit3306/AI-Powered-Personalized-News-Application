const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const DATA_PATH = path.join(__dirname, "db", "data.json");
const SEED_PATH = path.join(__dirname, "db", "seed.json");
const PUBLIC_ROOT = __dirname;
const TOKEN_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const ARTICLE_CACHE = new Map();
const DEFAULT_RSS_SOURCES = [
  { name: "TRT Haber - Türkiye", url: "https://www.trthaber.com/turkiye_articles.rss", category: "Türkiye" },
  { name: "TRT Haber - Gündem", url: "https://www.trthaber.com/gundem_articles.rss", category: "Gündem" },
  { name: "Habertürk - Gündem", url: "https://www.haberturk.com/rss/kategori/gundem.xml", category: "Gündem" },
  { name: "Habertürk - Tüm Haberler", url: "https://www.haberturk.com/rss", category: "Gündem" },
  { name: "Ensonhaber - Gündem", url: "https://www.ensonhaber.com/rss/gundem.xml", category: "Gündem" },
  { name: "Ensonhaber - Son Haberler", url: "https://www.ensonhaber.com/rss/ensonhaber.xml", category: "Gündem" }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.copyFileSync(SEED_PATH, DATA_PATH);
  }
}

function readDb() {
  ensureDataFile();
  const content = fs.readFileSync(DATA_PATH, "utf8").replace(/^\uFEFF/, "");
  return normalizeDb(JSON.parse(content));
}

function writeDb(db) {
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function normalizeDb(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.articles = Array.isArray(db.articles) ? db.articles : [];
  db.bookmarks = Array.isArray(db.bookmarks) ? db.bookmarks : [];
  db.readStatus = Array.isArray(db.readStatus) ? db.readStatus : [];
  db.preferences = db.preferences && typeof db.preferences === "object" ? db.preferences : {};
  db.userArticleEvents = Array.isArray(db.userArticleEvents)
    ? db.userArticleEvents
    : (Array.isArray(db.events) ? db.events : []);
  db.ingestionRuns = Array.isArray(db.ingestionRuns) ? db.ingestionRuns : [];
  db.institutionalEvents = Array.isArray(db.institutionalEvents) && db.institutionalEvents.length
    ? db.institutionalEvents
    : defaultInstitutionalEvents();
  db.eventReadStatus = Array.isArray(db.eventReadStatus) ? db.eventReadStatus : [];
  db.eventReminders = Array.isArray(db.eventReminders) ? db.eventReminders : [];
  db.hiddenEvents = Array.isArray(db.hiddenEvents) ? db.hiddenEvents : [];
  db.savedSearches = Array.isArray(db.savedSearches) ? db.savedSearches : [];
  for (const user of db.users) {
    db.preferences[user.id] = normalizePreferences(db.preferences[user.id]);
  }
  return db;
}

function normalizePreferences(preferences = {}) {
  const validReadingTimes = ["morning", "noon", "evening", "night"];
  const validDepths = ["short", "detailed", "mixed"];
  return {
    interests: Array.isArray(preferences.interests) && preferences.interests.length
      ? preferences.interests
      : ["Teknoloji", "Bilim"],
    preferredSources: Array.isArray(preferences.preferredSources) ? preferences.preferredSources : [],
    readingTimes: Array.isArray(preferences.readingTimes)
      ? preferences.readingTimes.filter((t) => validReadingTimes.includes(t))
      : [],
    contentDepth: validDepths.includes(preferences.contentDepth) ? preferences.contentDepth : "mixed",
    readingMode: preferences.readingMode || "daily",
    language: preferences.language || "tr",
    notifications: preferences.notifications !== false,
    darkMode: Boolean(preferences.darkMode),
    fontScale: Number(preferences.fontScale || 100),
    readingGoal: Math.max(1, Number(preferences.readingGoal || 20))
  };
}

function defaultInstitutionalEvents() {
  return [
    {
      id: "evt_academic_calendar",
      title: "Akademik takvim güncellemesi",
      category: "Akademik",
      date: "2026-05-13T09:00:00.000Z",
      summary: "Ders ekle-bırak ve danışman onay tarihlerinde güncelleme yayınlandı.",
      description: "Öğrenciler ders ekle-bırak işlemleri ve danışman onayları için güncellenen akademik takvimi kontrol etmelidir.",
      critical: true
    },
    {
      id: "evt_midterm_deadline",
      title: "Proje teslim son günü",
      category: "Son Tarih",
      date: "2026-05-15T17:00:00.000Z",
      summary: "Yazılım tasarım raporu ve sunum dosyaları için son teslim tarihi yaklaşıyor.",
      description: "Ekipler proje raporlarını, tasarım diyagramlarını ve sunum çıktılarının son sürümünü sisteme yüklemelidir.",
      critical: true
    },
    {
      id: "evt_ai_seminar",
      title: "Yapay zeka semineri",
      category: "Sosyal",
      date: "2026-05-18T14:00:00.000Z",
      summary: "Kampüste üretken yapay zeka araçlarının akademik kullanımı konuşulacak.",
      description: "Seminerde üretken yapay zeka araçlarının araştırma, yazım ve etik kullanım sınırları ele alınacaktır.",
      critical: false
    },
    {
      id: "evt_final_exam",
      title: "Final sınav programı duyurusu",
      category: "Sınav",
      date: "2026-05-20T10:00:00.000Z",
      summary: "Final sınav tarihleri ve sınıf bilgileri öğrenci panelinde yayınlandı.",
      description: "Öğrenciler sınav programını kontrol etmeli, çakışma varsa bölüm sekreterliğiyle iletişime geçmelidir.",
      critical: true
    }
  ];
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function pdf(res, filename, content) {
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=\"${filename}\"`,
    "Content-Length": content.length
  });
  res.end(content);
}

function hasEnv(name) {
  const value = process.env[name];
  return Boolean(value && value.trim() && !value.includes("your_") && !value.includes("_buraya"));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message = payload.message || payload.error?.message || payload.error || `HTTP ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`RSS kaynağı okunamadı: HTTP ${response.status}`);
  }
  return text;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripHtml(value) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArticleTextFromHtml(html) {
  const jsonLdBodies = [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => {
      try {
        const data = JSON.parse(decodeHtml(match[1]).trim());
        const items = Array.isArray(data) ? data : [data];
        return items
          .flatMap((item) => item["@graph"] || item)
          .map((item) => item?.articleBody || item?.description || "")
          .filter(Boolean)
          .join(" ");
      } catch {
        return "";
      }
    })
    .filter((text) => text.length > 300);
  if (jsonLdBodies.length) return stripHtml(jsonLdBodies.sort((a, b) => b.length - a.length)[0]);

  const articleBlocks = [...String(html || "").matchAll(/<article[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  const candidates = articleBlocks.length ? articleBlocks : [html];
  const paragraphs = candidates.flatMap((block) => [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length > 35 && !/çerez|cookie|reklam|abonelik|javascript/i.test(text)));
  return [...new Set(paragraphs)].join("\n\n").trim();
}

async function fetchArticleFullText(article) {
  if (!article?.sourceUrl || article.sourceUrl.includes("example.com")) return article;
  const existing = String(article.fullText || "");
  if (existing.length > String(article.summary || "").length + 250) return article;
  try {
    const html = await fetchText(article.sourceUrl, {
      headers: {
        "User-Agent": "KisiselGazetem/1.0 Article Reader",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    const fullText = extractArticleTextFromHtml(html);
    if (fullText.length > existing.length + 120) {
      return {
        ...article,
        fullText,
        contentStatus: "full_from_source_page"
      };
    }
  } catch {
    return article;
  }
  return article;
}

function extractXmlTag(block, tagName) {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function extractXmlAttr(block, tagName, attrName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTag}[^>]*\\s${escapedAttr}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function getRssSources() {
  const raw = process.env.RSS_FEEDS || "";
  const urls = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !item.includes("example.com") && !item.includes("example.org"));

  if (!urls.length) return DEFAULT_RSS_SOURCES;

  return urls.map((url, index) => ({
    name: `RSS Kaynağı ${index + 1}`,
    url,
    category: "Gündem"
  }));
}

function parseRssItems(xml, source) {
  const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  return itemBlocks.map((block) => {
    const title = stripHtml(extractXmlTag(block, "title"));
    const link = stripHtml(extractXmlTag(block, "link")) || stripHtml(extractXmlTag(block, "guid"));
    const description = stripHtml(extractXmlTag(block, "description"));
    const encodedContent = stripHtml(extractXmlTag(block, "content:encoded"));
    const fullText = encodedContent || description || title || "";
    const pubDate = stripHtml(extractXmlTag(block, "pubDate")) || stripHtml(extractXmlTag(block, "dc:date"));
    const enclosure = extractXmlAttr(block, "enclosure", "url");
    const mediaContent = extractXmlAttr(block, "media:content", "url");
    const mediaThumbnail = extractXmlAttr(block, "media:thumbnail", "url");
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    const id = `rss_${crypto.createHash("sha1").update(link || title || crypto.randomUUID()).digest("hex").slice(0, 16)}`;

    const article = {
      id,
      title: title || "Başlıksız haber",
      summary: description || title || "",
      fullText,
      contentStatus: encodedContent ? "full_from_feed" : "summary_only",
      category: source.category || "Gündem",
      tags: [source.category || "Gündem"],
      sourceName: source.name,
      sourceUrl: link,
      imageUrl: mediaContent || mediaThumbnail || enclosure || "",
      author: "",
      publishedAt,
      aiSummary: "",
      contentHash: crypto.createHash("sha256").update(normalizeText(`${title} ${description}`)).digest("hex"),
      externalProvider: "rss"
    };
    article.category = inferArticleCategory(article);
    article.tags = [article.category];
    return article;
  }).filter((article) => article.title && article.sourceUrl);
}

async function fetchRssArticles(limit = 30) {
  const sources = getRssSources();
  const results = await Promise.allSettled(sources.map(async (source) => {
    const xml = await fetchText(source.url, {
      headers: {
        "User-Agent": "KisiselGazetem/1.0 RSS Reader"
      }
    });
    return parseRssItems(xml, source);
  }));

  const seen = new Set();
  return results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((article) => {
      const key = article.sourceUrl || article.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}

function normalizeProviderArticles(provider, payload) {
  if (provider === "freenewsapi") {
    return (payload.data || []).map((item) => ({
      uuid: item.uuid,
      title: item.title,
      summary: item.subtitle || item.description || item.body || item.title,
      fullText: item.body || item.subtitle || item.description || item.title,
      category: item.topics?.[0] || "Gündem",
      source: item.publisher,
      url: item.original_url || item.url,
      imageUrl: item.thumbnail || item.image,
      publishedAt: item.published_at,
      contentStatus: item.body ? "full_from_api" : "summary_only"
    }));
  }
  if (provider === "newsapi") {
    return (payload.articles || []).map((item) => ({
      title: item.title,
      summary: item.description || item.content || item.title,
      fullText: item.content || item.description || item.title,
      category: "Gündem",
      source: item.source?.name,
      url: item.url,
      imageUrl: item.urlToImage,
      publishedAt: item.publishedAt
    }));
  }
  if (provider === "gnews") {
    return (payload.articles || []).map((item) => ({
      title: item.title,
      summary: item.description || item.content || item.title,
      fullText: item.content || item.description || item.title,
      category: "Gündem",
      source: item.source?.name,
      url: item.url,
      imageUrl: item.image,
      publishedAt: item.publishedAt
    }));
  }
  if (provider === "mediastack") {
    return (payload.data || []).map((item) => ({
      title: item.title,
      summary: item.description || item.title,
      fullText: item.description || item.title,
      category: item.category || "Gündem",
      source: item.source,
      url: item.url,
      imageUrl: item.image,
      publishedAt: item.published_at
    }));
  }
  return [];
}

function getNewsProviderEndpoint(limit = 10) {
  if (hasEnv("FREENEWSAPI_KEY")) {
    return {
      provider: "freenewsapi",
      endpoint: `https://api.freenewsapi.io/v1/news?language=tr&country=tr&page_size=${limit}`
    };
  }
  if (hasEnv("GNEWS_API_KEY")) {
    return {
      provider: "gnews",
      endpoint: `https://gnews.io/api/v4/top-headlines?country=tr&lang=tr&max=${limit}&apikey=${encodeURIComponent(process.env.GNEWS_API_KEY)}`
    };
  }
  if (hasEnv("NEWS_API_KEY")) {
    return {
      provider: "newsapi",
      endpoint: `https://newsapi.org/v2/top-headlines?country=tr&pageSize=${limit}&apiKey=${encodeURIComponent(process.env.NEWS_API_KEY)}`
    };
  }
  if (hasEnv("MEDIASTACK_API_KEY")) {
    return {
      provider: "mediastack",
      endpoint: `http://api.mediastack.com/v1/news?countries=tr&languages=tr&limit=${limit}&access_key=${encodeURIComponent(process.env.MEDIASTACK_API_KEY)}`
    };
  }
  return null;
}

async function fetchNewsProviderArticles(limit = 10) {
  const config = getNewsProviderEndpoint(limit);
  if (!config) return [];
  const payload = await fetchJson(config.endpoint, config.provider === "freenewsapi" ? {
    headers: {
      "x-api-key": process.env.FREENEWSAPI_KEY
    }
  } : {});
  let normalized = normalizeProviderArticles(config.provider, payload);
  if (config.provider === "freenewsapi") {
    normalized = await Promise.all(normalized.map(async (item) => {
      if (!item.uuid) return item;
      try {
        const details = await fetchJson(`https://api.freenewsapi.io/v1/details?uuid=${encodeURIComponent(item.uuid)}`, {
          headers: {
            "x-api-key": process.env.FREENEWSAPI_KEY
          }
        });
        const detail = details.data || {};
        return {
          ...item,
          title: detail.title || item.title,
          summary: detail.subtitle || item.summary,
          fullText: detail.body || item.fullText,
          source: detail.publisher || item.source,
          url: detail.original_url || item.url,
          imageUrl: detail.thumbnail || item.imageUrl,
          publishedAt: detail.published_at || item.publishedAt,
          contentStatus: detail.body ? "full_from_api" : item.contentStatus
        };
      } catch {
        return item;
      }
    }));
  }
  return normalized.map((item) => {
    const id = `api_${crypto.createHash("sha1").update(item.url || item.title || crypto.randomUUID()).digest("hex").slice(0, 16)}`;
    const article = {
      id,
      title: item.title || "Başlıksız haber",
      summary: item.summary || item.title || "",
      fullText: item.fullText || item.summary || item.title || "",
      category: item.category || "Gündem",
      tags: [item.category || "Gündem"],
      sourceName: item.source || config.provider,
      sourceUrl: item.url || "",
      imageUrl: item.imageUrl || "",
      author: "",
      publishedAt: item.publishedAt || new Date().toISOString(),
      aiSummary: "",
      contentStatus: item.contentStatus || "provider_text",
      contentHash: crypto.createHash("sha256").update(normalizeText(`${item.title} ${item.summary}`)).digest("hex"),
      externalProvider: config.provider
    };
    article.category = inferArticleCategory(article);
    article.tags = [article.category];
    return article;
  });
}

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
  });
}

function getGeminiApiKey() {
  if (hasEnv("GEMINI_API_KEY")) return process.env.GEMINI_API_KEY;
  if (hasEnv("GOOGLE_API_KEY")) return process.env.GOOGLE_API_KEY;
  return "";
}

function getGeminiModel() {
  const configured = process.env.GEMINI_MODEL || process.env.AI_MODEL || "";
  if (!configured || configured === "gemini-1.5-flash") return "gemini-2.5-flash";
  return configured;
}

function geminiGenerationConfig(options = {}) {
  const model = options.model || getGeminiModel();
  return {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 512,
    ...(model.startsWith("gemini-2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {})
  };
}

async function generateEntityInfo(entity, relatedArticles = []) {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY bulunamadı. .env içine GEMINI_API_KEY ekle.");
  }
  const model = getGeminiModel();
  const context = relatedArticles
    .slice(0, 5)
    .map((article, index) => `${index + 1}. ${article.title || ""} - ${article.summary || ""}`)
    .join("\n");
  const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{
            text: [
              "Türkçe kısa bir haber bilgi kartı yaz.",
              "Kişi, ülke, kurum, olay veya tarih hakkında tarafsız ansiklopedik özet ver.",
              "Konu adını tek başına döndürme; kim/nedir, hangi görev/alan veya olayla bilinir açıkla.",
              "En az 18 kelime, en fazla 2 cümle yaz. Markdown kullanma. Emin olmadığın ayrıntıyı uydurma.",
              `Konu: ${entity}`,
              context ? `Haber bağlamı:\n${context}` : ""
            ].filter(Boolean).join("\n")
          }]
        }
      ],
      generationConfig: geminiGenerationConfig({ model, maxOutputTokens: 512 })
    })
  });
  return {
    provider: "gemini",
    model,
    description: payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim() || ""
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("İstek gövdesi çok büyük."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        const cleanBody = body.replace(/^\uFEFF/, "").trim();
        resolve(cleanBody ? JSON.parse(cleanBody) : {});
      } catch {
        reject(new Error("Geçersiz JSON."));
      }
    });
  });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (parsed.exp < Date.now()) return null;
  return parsed.sub;
}

function getUserId(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyToken(token) || "user_demo";
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function inferArticleCategory(article) {
  const text = normalizeText(`${article.title || ""} ${article.summary || ""} ${article.fullText || ""} ${article.sourceUrl || article.url || ""} ${article.sourceName || article.source || ""}`);
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
  if (article.category && article.category !== "Gündem" && article.category !== "Türkiye") return article.category;
  const match = rules
    .map(([category, words]) => ({
      category,
      score: words.reduce((sum, word) => sum + (text.includes(normalizeText(word)) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  return match?.category || article.category || "Gündem";
}

function contentHash(article) {
  return crypto.createHash("sha256").update(normalizeText(`${article.title} ${article.summary}`)).digest("hex");
}

function similarity(a, b) {
  const left = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const right = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

function storyTokens(value) {
  const stopWords = new Set([
    "ve", "ile", "icin", "bir", "bu", "da", "de", "son", "yeni", "olarak", "olan", "dedi",
    "haber", "gore", "daha", "kadar", "sonra", "once", "ise", "the", "and", "for", "from"
  ]);
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function weightedStorySimilarity(article, candidate) {
  const titleScore = similarity(article.title, candidate.title);
  const summaryScore = similarity(`${article.summary} ${article.fullText || ""}`, `${candidate.summary} ${candidate.fullText || ""}`);
  const left = new Set(storyTokens(`${article.title} ${article.summary}`).slice(0, 40));
  const right = new Set(storyTokens(`${candidate.title} ${candidate.summary}`).slice(0, 40));
  const shared = [...left].filter((word) => right.has(word)).length;
  const entityScore = shared / Math.max(4, Math.min(left.size || 1, right.size || 1));
  const sourceBonus = normalizeText(article.sourceName || article.source) !== normalizeText(candidate.sourceName || candidate.source) ? 0.04 : -0.08;
  return Math.max(0, Math.min(1, titleScore * 0.48 + summaryScore * 0.28 + entityScore * 0.24 + sourceBonus));
}

function dedupeFeedArticles(articles, limit = 120) {
  const unique = [];
  for (const article of articles) {
    const sameStory = unique.some((existing) => weightedStorySimilarity(existing, article) >= 0.48);
    if (!sameStory) unique.push(article);
    if (unique.length >= limit) break;
  }
  return unique;
}

function decorateArticle(db, userId, article) {
  const read = db.readStatus.find((item) => item.userId === userId && item.articleId === article.id);
  const bookmarked = db.bookmarks.some((item) => item.userId === userId && item.articleId === article.id);
  return {
    ...article,
    bookmarked,
    status: read?.status === "read" ? "Okundu" : "Okunmadı",
    duplicateGroupId: article.duplicateGroupId || null
  };
}

function articleScoringText(article) {
  return `${article.title || ""} ${article.summary || ""} ${article.fullText || ""}`;
}

function buildReadingProfile(db, userId, articles = []) {
  const articleById = new Map();
  for (const article of [...db.articles, ...articles, ...ARTICLE_CACHE.values()]) {
    if (article?.id) articleById.set(String(article.id), article);
  }
  const readArticles = db.readStatus
    .filter((item) => item.userId === userId && item.status === "read")
    .map((item) => articleById.get(String(item.articleId)))
    .filter(Boolean);
  const bookmarkedArticles = db.bookmarks
    .filter((item) => item.userId === userId)
    .map((item) => articleById.get(String(item.articleId)))
    .filter(Boolean);
  const categoryReads = new Map();
  for (const article of readArticles) {
    categoryReads.set(article.category, (categoryReads.get(article.category) || 0) + 1);
  }
  const maxCategoryReads = Math.max(1, ...categoryReads.values(), 1);
  return { readArticles, bookmarkedArticles, categoryReads, maxCategoryReads };
}

function tokenOverlapScore(article, candidates) {
  const articleTokens = new Set(storyTokens(articleScoringText(article)).slice(0, 45));
  if (!articleTokens.size || !candidates.length) return 0;
  let best = 0;
  for (const candidate of candidates) {
    if (String(candidate.id) === String(article.id)) continue;
    const candidateTokens = new Set(storyTokens(articleScoringText(candidate)).slice(0, 45));
    const shared = [...articleTokens].filter((token) => candidateTokens.has(token)).length;
    best = Math.max(best, shared / Math.max(6, Math.min(articleTokens.size, candidateTokens.size || 1)));
  }
  return best;
}

function maxReadSimilarity(article, readArticles) {
  let best = 0;
  for (const readArticle of readArticles) {
    if (String(readArticle.id) === String(article.id)) continue;
    best = Math.max(best, similarity(articleScoringText(article), articleScoringText(readArticle)));
  }
  return best;
}

function scoreArticle(article, preferences, readingProfile = null) {
  const interests = preferences?.interests || [];
  const selectedCategory = interests.includes(article.category);
  let score = selectedCategory ? 50 : 15;
  if (!readingProfile?.readArticles?.length) return score;

  const sameCategoryReads = readingProfile.categoryReads.get(article.category) || 0;
  const sameCategoryReadArticles = readingProfile.readArticles.filter((item) => item.category === article.category);
  if (!sameCategoryReadArticles.length) return score;

  if (sameCategoryReads) {
    score += Math.min(18, Math.round((sameCategoryReads / readingProfile.maxCategoryReads) * 18));
  }

  score += Math.round(tokenOverlapScore(article, sameCategoryReadArticles) * 18);
  score += Math.round(maxReadSimilarity(article, sameCategoryReadArticles) * 24);

  const sameCategoryBookmarkedArticles = readingProfile.bookmarkedArticles.filter((item) => item.category === article.category);
  const bookmarkOverlap = tokenOverlapScore(article, sameCategoryBookmarkedArticles);
  score += Math.round(bookmarkOverlap * 8);

  return Math.max(5, Math.min(99, Math.round(score)));
}

async function confirmSameStoriesWithAi(article, candidates) {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey || !candidates.length) return null;
  const model = getGeminiModel();
  try {
    const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{
              text: [
                "Aşağıdaki adaylardan hangileri ana haberle birebir aynı olayı anlatıyor? Dil ve anlatım farklı olabilir.",
                "Sadece aynı olay/aynı gelişme olanların id değerlerini JSON dizi olarak döndür. Örnek: [\"id1\",\"id2\"]",
                `ANA HABER: ${article.title}\n${article.summary}`,
                "ADAYLAR:",
                ...candidates.map((candidate) => `${candidate.id}: ${candidate.title}\n${candidate.summary}`)
              ].join("\n\n")
            }]
          }
        ],
        generationConfig: geminiGenerationConfig({ model, temperature: 0, maxOutputTokens: 256 })
      })
    });
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;
    const ids = JSON.parse(jsonMatch[0]);
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return null;
  }
}

async function findDuplicates(db, article) {
  const allArticles = [
    ...ARTICLE_CACHE.values(),
    ...db.articles
  ];
  const seen = new Set();
  const candidates = allArticles
    .filter((candidate) => {
      if (!candidate || String(candidate.id) === String(article.id) || seen.has(String(candidate.id))) return false;
      seen.add(String(candidate.id));
      return normalizeText(candidate.sourceName || candidate.source) !== normalizeText(article.sourceName || article.source);
    })
    .map((candidate) => ({
      id: String(candidate.id),
      title: candidate.title,
      summary: candidate.summary,
      sourceName: candidate.sourceName || candidate.source || "Bilinmeyen kaynak",
      sourceUrl: candidate.sourceUrl,
      score: weightedStorySimilarity(article, candidate)
    }))
    .filter((candidate) => candidate.score >= 0.30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const aiIds = await confirmSameStoriesWithAi(article, candidates.slice(0, 8));
  const confirmed = aiIds
    ? candidates.filter((candidate) => aiIds.has(candidate.id))
    : candidates.filter((candidate) => candidate.score >= 0.42);
  return confirmed.slice(0, 6).map(({ score, ...candidate }) => candidate);
}

function articleSummary(article) {
  if (article.aiSummary) return article.aiSummary;
  const firstSentence = article.fullText.split(/[.!?]/).map((part) => part.trim()).filter(Boolean)[0];
  return firstSentence ? `${firstSentence}.` : article.summary;
}

function decorateEvent(db, userId, event) {
  const read = db.eventReadStatus.some((item) => item.userId === userId && item.eventId === event.id);
  const reminder = db.eventReminders.some((item) => item.userId === userId && item.eventId === event.id);
  return {
    ...event,
    read,
    reminder,
    notificationStatus: event.critical ? "Kritik bildirim" : "Normal"
  };
}

function fallbackLiveTicketEvents() {
  const day = 24 * 60 * 60 * 1000;
  const base = Date.now();
  return [
    {
      id: "live_event_melike_sahin",
      title: "Melike Şahin Konseri",
      category: "Konser",
      date: new Date(base + day * 5).toISOString(),
      venue: "Bostancı Gösteri Merkezi",
      city: "İstanbul",
      summary: "Popüler sanatçının İstanbul konseri için biletler satışta.",
      description: "Biletix tarzı canlı etkinlik akışında gösterilen konser kartı. API anahtarı eklendiğinde bu alan Ticketmaster Discovery verisiyle güncellenir.",
      sourceProvider: "Smart Events",
      ticketUrl: "https://www.biletix.com/",
      imageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
      critical: false
    },
    {
      id: "live_event_standup",
      title: "Stand-Up Gecesi",
      category: "Sahne",
      date: new Date(base + day * 8).toISOString(),
      venue: "Maximum Uniq Hall",
      city: "İstanbul",
      summary: "Komedi sahnesinden yeni gösteri ve sınırlı kontenjanlı biletler.",
      description: "Yaklaşan sahne etkinliği, tarih ve mekan bilgisiyle etkinlikler akışına eklendi.",
      sourceProvider: "Smart Events",
      ticketUrl: "https://www.biletix.com/",
      imageUrl: "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=900&q=80",
      critical: false
    },
    {
      id: "live_event_jazz",
      title: "Caz Akşamı",
      category: "Festival",
      date: new Date(base + day * 12).toISOString(),
      venue: "Zorlu PSM",
      city: "İstanbul",
      summary: "Şehirde caz, elektronik ve alternatif sahneden seçili performanslar.",
      description: "Müzik odaklı etkinlik keşfi için hazırlanan örnek canlı etkinlik kartı.",
      sourceProvider: "Smart Events",
      ticketUrl: "https://www.biletix.com/",
      imageUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=900&q=80",
      critical: false
    }
  ];
}

function normalizeTicketmasterEvent(item) {
  const venue = item._embedded?.venues?.[0] || {};
  const image = (item.images || [])
    .filter((img) => img.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  const segment = item.classifications?.[0]?.segment?.name;
  const genre = item.classifications?.[0]?.genre?.name;
  const localDate = item.dates?.start?.localDate || "";
  const localTime = item.dates?.start?.localTime || "20:00:00";
  const date = localDate ? new Date(`${localDate}T${localTime}`).toISOString() : new Date().toISOString();
  const venueName = venue.name || "Mekan açıklanacak";
  const city = venue.city?.name || venue.country?.name || "Türkiye";
  return {
    id: `tm_${item.id}`,
    title: item.name || "Etkinlik",
    category: genre || segment || "Etkinlik",
    date,
    venue: venueName,
    city,
    summary: `${venueName}${city ? `, ${city}` : ""}. ${item.info || item.pleaseNote || "Bilet ve detaylar etkinlik sayfasında."}`,
    description: item.description || item.info || item.pleaseNote || `${item.name || "Etkinlik"} için güncel bilet ve mekan bilgileri.`,
    sourceProvider: "Ticketmaster Discovery",
    ticketUrl: item.url || "",
    imageUrl: image?.url || "",
    critical: false
  };
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ccedil;/g, "ç").replace(/&Ccedil;/g, "Ç")
    .replace(/&uuml;/g, "ü").replace(/&Uuml;/g, "Ü")
    .replace(/&ouml;/g, "ö").replace(/&Ouml;/g, "Ö")
    .replace(/&nbsp;/g, " ")
    .replace(/&#351;/g, "ş").replace(/&#350;/g, "Ş")
    .replace(/&#305;/g, "ı").replace(/&#304;/g, "İ")
    .replace(/&#287;/g, "ğ").replace(/&#286;/g, "Ğ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferBiletixType(title, href) {
  const text = normalizeText(`${title} ${href}`);
  if (/(konser|muzik|müzik|jolly|festival|akustik|metal|jazz|dj|sahne)/.test(text)) return "Müzik";
  if (/(tiyatro|stand up|standup|komedi|muzikal|sahne|tolgshow|don kisot|afife|madonna)/.test(text)) return "Sahne";
  if (/(spor|mac|maç|fight|tenis|basket|futbol|champions)/.test(text)) return "Spor";
  if (/(aile|cocuk|çocuk|squid|experience|muzesi|müze|play)/.test(text)) return "Aile";
  if (/(egitim|eğitim|workshop|atolye|yoga|seminar)/.test(text)) return "Eğitim";
  return "Etkinlik";
}

function biletixCityCode(city = "ISTANBUL") {
  const normalized = normalizeText(city).replace(/\s+/g, "");
  const map = {
    istanbul: "ISTANBUL",
    ankara: "ANKARA",
    izmir: "IZMIR",
    bursa: "BURSA",
    antalya: "ANTALYA",
    adana: "ADANA",
    eskisehir: "ESKISEHIR",
    konya: "KONYA",
    turkiye: "TURKIYE",
    türkiye: "TURKIYE"
  };
  return map[normalized] || "ISTANBUL";
}

function biletixSearchUrl(cityCode) {
  return `https://www.biletix.com/anasayfa/${encodeURIComponent(cityCode)}/tr`;
}

async function fetchBiletixEvents({ city = "ISTANBUL", type = "Tümü", limit = 36 } = {}) {
  const cityCode = biletixCityCode(city);
  const html = await fetchText(biletixSearchUrl(cityCode), {
    headers: {
      "User-Agent": "Mozilla/5.0 SmartNewspaper/1.0",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
    }
  });
  const anchors = [...html.matchAll(/<a[^>]+href="([^"]*(?:etkinlik|performance)[^"]*)"[^>]*>([\s\S]{0,500}?)<\/a>/gi)];
  const seen = new Set();
  const events = [];
  for (const match of anchors) {
    let href = decodeHtml(match[1]);
    let title = decodeHtml(match[2]);
    if (!title || title.length < 3 || /onlineetkinlikler/i.test(href)) continue;
    if (!/^https?:\/\//i.test(href)) href = `https://www.biletix.com${href.startsWith("/") ? "" : "/"}${href}`;
    const cleanUrl = href.replace(/&amp;/g, "&");
    const idMatch = cleanUrl.match(/\/(?:performance|etkinlik|etkinlik-grup)\/([^/?]+)/);
    const id = `biletix_${idMatch?.[1] || crypto.createHash("sha1").update(cleanUrl).digest("hex").slice(0, 10)}`;
    if (seen.has(id)) continue;
    const category = inferBiletixType(title, cleanUrl);
    if (type && type !== "Tümü" && category !== type) continue;
    seen.add(id);
    events.push({
      id,
      title,
      category,
      date: new Date(Date.now() + (events.length + 2) * 24 * 60 * 60 * 1000).toISOString(),
      venue: cityCode === "TURKIYE" ? "Türkiye" : cityCode[0] + cityCode.slice(1).toLocaleLowerCase("tr-TR"),
      city: cityCode === "TURKIYE" ? "Türkiye" : cityCode[0] + cityCode.slice(1).toLocaleLowerCase("tr-TR"),
      summary: "Biletix üzerinde listelenen güncel biletli etkinlik. Detay ve bilet alma için etkinlik sayfasına yönlendirilirsin.",
      description: `${title} için Biletix etkinlik sayfası. Bilet satın alma, tarih, mekan ve koltuk seçimi bilgileri Biletix üzerinde gösterilir.`,
      sourceProvider: "Biletix",
      ticketUrl: cleanUrl,
      imageUrl: "",
      critical: false
    });
    if (events.length >= limit) break;
  }
  return events;
}

async function fetchTicketmasterEvents() {
  if (!hasEnv("TICKETMASTER_API_KEY")) return { provider: "fallback", events: fallbackLiveTicketEvents() };
  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY.trim(),
    countryCode: process.env.EVENT_COUNTRY_CODE || "TR",
    city: process.env.EVENT_CITY || "Istanbul",
    size: process.env.EVENT_SIZE || "18",
    sort: "date,asc",
    locale: "*"
  });
  const payload = await fetchJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
  const events = (payload._embedded?.events || []).map(normalizeTicketmasterEvent);
  return { provider: "ticketmaster", events: events.length ? events : fallbackLiveTicketEvents() };
}

function wrapText(text, maxChars) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pdfEscape(value) {
  return String(value || "")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function getJpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xC0 && marker <= 0xC3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

async function fetchPdfImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "KisiselGazetem/1.0 PDF Export" }
    });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !/jpe?g/i.test(type)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const size = getJpegSize(buffer);
    return size ? { ...size, data: buffer } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buildSimplePdf({ title, layout, articles, events }) {
  const configs = {
    a4: { width: 595, height: 842, margin: 38, name: "A4 KLASIK GAZETE" },
    tabloid: { width: 792, height: 1224, margin: 44, name: "TABLOID GENIS SAYFA" },
    booklet: { width: 420, height: 595, margin: 28, name: "KITAPCIK DUZENI" }
  };
  const cfg = configs[layout] || configs.a4;
  const blocks = articles.slice(0, 18).map((article, index) => ({
    title: article.title || "Basliksiz haber",
    meta: `${article.category || "Haber"} | ${article.sourceName || article.source || ""}`,
    body: article.summary || article.fullText || "",
    imageUrl: article.imageUrl || "",
    lead: index === 0
  }));
  if (events.length) {
    blocks.push({
      title: "Kurumsal etkinlik ve duyurular",
      meta: "Kampus",
      body: events.slice(0, 4).map((event) => `${event.category}: ${event.title}. ${event.summary || event.description}`).join(" "),
      imageUrl: "",
      lead: false
    });
  }

  await Promise.all(blocks.slice(0, 12).map(async (block, index) => {
    const image = await fetchPdfImage(block.imageUrl);
    if (image) block.image = { ...image, name: `Im${index + 1}` };
  }));

  const objects = [];
  function addObject(body) {
    objects.push(body);
    return objects.length;
  }

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const imageObjects = [];
  for (const block of blocks) {
    if (!block.image) continue;
    const img = block.image;
    const objectId = addObject(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n${img.data.toString("binary")}\nendstream`);
    imageObjects.push({ name: img.name, objectId });
  }

  const pageStreams = [];
  let commands = [];
  let pageNumber = 0;

  function text(x, y, size, value, font = "F1") {
    commands.push("BT", `/${font} ${size} Tf`, `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`, `(${pdfEscape(value)}) Tj`, "ET");
  }

  function line(x1, y1, x2, y2, width = 0.6) {
    commands.push("0 G", `${width} w`, `${x1.toFixed(2)} ${y1.toFixed(2)} m`, `${x2.toFixed(2)} ${y2.toFixed(2)} l`, "S");
  }

  function rect(x, y, w, h, gray = 0.94) {
    commands.push(`${gray} g`, `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`, "f", "0 g");
  }

  function drawImage(block, x, y, w, h) {
    if (block.image) {
      commands.push("q", `${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`, `/${block.image.name} Do`, "Q");
    } else {
      rect(x, y, w, h, 0.9);
      text(x + 10, y + h / 2 - 4, 8, "FOTOGRAF", "F2");
    }
  }

  function paragraph(x, y, widthChars, lines, size = 9.5, font = "F1", leading = size + 3) {
    let currentY = y;
    for (const lineText of wrapText(lines, widthChars)) {
      text(x, currentY, size, lineText, font);
      currentY -= leading;
    }
    return currentY;
  }

  function newPage() {
    if (commands.length) pageStreams.push(commands.join("\n"));
    commands = [];
    pageNumber += 1;
    text(cfg.margin, cfg.height - cfg.margin, 22, title, "F2");
    text(cfg.margin, cfg.height - cfg.margin - 17, 8.5, `${cfg.name} | Sayfa ${pageNumber}`, "F1");
    line(cfg.margin, cfg.height - cfg.margin - 28, cfg.width - cfg.margin, cfg.height - cfg.margin - 28, 1.1);
    return cfg.height - cfg.margin - 48;
  }

  function drawCard(block, x, y, w, h, style) {
    rect(x, y - h, w, h, 0.985);
    if (style === "imageTop") {
      drawImage(block, x + 8, y - 78, w - 16, 68);
      let ty = paragraph(x + 8, y - 94, Math.floor((w - 16) / 5.7), block.title, 11, "F2", 13);
      text(x + 8, ty - 2, 7.5, block.meta.toUpperCase(), "F1");
      paragraph(x + 8, ty - 15, Math.floor((w - 16) / 5.2), block.body, 8.5, "F1", 11);
    } else {
      drawImage(block, x + 8, y - 94, 116, 82);
      let ty = paragraph(x + 132, y - 22, Math.floor((w - 140) / 5.8), block.title, 10.5, "F2", 12);
      text(x + 132, ty - 1, 7, block.meta.toUpperCase(), "F1");
      paragraph(x + 132, ty - 13, Math.floor((w - 140) / 5.3), block.body, 8.2, "F1", 10);
    }
  }

  if (layout === "tabloid") {
    let y = newPage();
    const lead = blocks[0];
    if (lead) {
      drawImage(lead, cfg.margin, y - 215, 350, 205);
      let ty = paragraph(cfg.margin + 370, y - 10, 42, lead.title, 22, "F2", 25);
      text(cfg.margin + 370, ty - 2, 9, lead.meta.toUpperCase(), "F1");
      paragraph(cfg.margin + 370, ty - 18, 48, lead.body, 11, "F1", 14);
      y -= 245;
    }
    const gap = 16;
    const colW = (cfg.width - cfg.margin * 2 - gap * 2) / 3;
    let col = 0;
    for (const block of blocks.slice(1)) {
      if (y - 210 < cfg.margin) { y = newPage(); col = 0; }
      drawCard(block, cfg.margin + col * (colW + gap), y, colW, 198, "imageTop");
      col += 1;
      if (col === 3) { col = 0; y -= 214; }
    }
  } else if (layout === "booklet") {
    let y = newPage();
    for (const block of blocks) {
      if (y - 116 < cfg.margin) y = newPage();
      drawCard(block, cfg.margin, y, cfg.width - cfg.margin * 2, 106, "imageLeft");
      y -= 120;
    }
  } else {
    let y = newPage();
    const lead = blocks[0];
    if (lead) {
      drawImage(lead, cfg.margin, y - 188, cfg.width - cfg.margin * 2, 178);
      let ty = paragraph(cfg.margin, y - 210, 58, lead.title, 20, "F2", 23);
      text(cfg.margin, ty - 3, 8.5, lead.meta.toUpperCase(), "F1");
      paragraph(cfg.margin, ty - 20, 68, lead.body, 10.5, "F1", 13);
      y = ty - 78;
    }
    const gap = 16;
    const colW = (cfg.width - cfg.margin * 2 - gap) / 2;
    let col = 0;
    for (const block of blocks.slice(1)) {
      if (y - 178 < cfg.margin) { y = newPage(); col = 0; }
      drawCard(block, cfg.margin + col * (colW + gap), y, colW, 166, "imageTop");
      col += 1;
      if (col === 2) { col = 0; y -= 184; }
    }
  }
  if (commands.length) pageStreams.push(commands.join("\n"));

  const xobjects = imageObjects.length
    ? `/XObject << ${imageObjects.map((img) => `/${img.name} ${img.objectId} 0 R`).join(" ")} >>`
    : "";
  const pageIds = [];
  for (const stream of pageStreams) {
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${cfg.width} ${cfg.height}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> ${xobjects} >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

async function handleApi(req, res, url) {
  const db = readDb();
  const userId = getUserId(req);

  if (req.method === "GET" && url.pathname === "/api/integrations/status") {
    return json(res, 200, {
      newsApi: hasEnv("NEWS_API_KEY"),
      freeNewsApi: hasEnv("FREENEWSAPI_KEY"),
      gnews: hasEnv("GNEWS_API_KEY"),
      mediastack: hasEnv("MEDIASTACK_API_KEY"),
      gemini: Boolean(getGeminiApiKey()),
      openai: hasEnv("OPENAI_API_KEY"),
      rssFeeds: getRssSources().length,
      aiModel: process.env.AI_MODEL || process.env.GEMINI_MODEL || null
    });
  }

  if (req.method === "GET" && url.pathname === "/api/news/sources") {
    return json(res, 200, {
      sources: getRssSources().map((source) => ({
        name: source.name,
        url: source.url,
        category: source.category,
        type: "rss"
      }))
    });
  }

  if (req.method === "GET" && url.pathname === "/api/searches") {
    return json(res, 200, {
      searches: db.savedSearches
        .filter((item) => item.userId === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  }

  if (req.method === "POST" && url.pathname === "/api/searches") {
    const body = await readBody(req);
    const filters = body.filters || {};
    const label = String(body.label || filters.query || "Kayıtlı arama").trim().slice(0, 80);
    const savedSearch = {
      id: `search_${crypto.randomUUID()}`,
      userId,
      label,
      filters: {
        query: String(filters.query || ""),
        category: String(filters.category || "Tümü"),
        source: String(filters.source || "Tümü"),
        status: String(filters.status || "Tümü"),
        date: String(filters.date || "Tümü"),
        sort: String(filters.sort || "relevance")
      },
      createdAt: new Date().toISOString()
    };
    db.savedSearches.push(savedSearch);
    writeDb(db);
    return json(res, 201, { search: savedSearch });
  }

  const savedSearchMatch = url.pathname.match(/^\/api\/searches\/([^/]+)$/);
  if (req.method === "DELETE" && savedSearchMatch) {
    const searchId = savedSearchMatch[1];
    const before = db.savedSearches.length;
    db.savedSearches = db.savedSearches.filter((item) => !(item.userId === userId && item.id === searchId));
    if (db.savedSearches.length === before) return json(res, 404, { error: "Kayıtlı arama bulunamadı." });
    writeDb(db);
    return json(res, 200, { deleted: true });
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    const hidden = new Set(db.hiddenEvents.filter((item) => item.userId === userId).map((item) => item.eventId));
    let liveEvents = [];
    let provider = "biletix";
    const city = url.searchParams.get("city") || process.env.EVENT_CITY || "ISTANBUL";
    const type = url.searchParams.get("type") || "Tümü";
    try {
      liveEvents = await fetchBiletixEvents({ city, type, limit: 48 });
    } catch (error) {
      liveEvents = fallbackLiveTicketEvents().filter((event) => type === "Tümü" || event.category === type);
      provider = "fallback";
    }
    const events = liveEvents
      .filter((event) => !hidden.has(event.id))
      .map((event) => decorateEvent(db, userId, event))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return json(res, 200, {
      provider,
      filters: {
        cities: ["ISTANBUL", "ANKARA", "IZMIR", "BURSA", "ANTALYA", "ADANA", "TURKIYE"],
        types: ["Tümü", "Müzik", "Sahne", "Spor", "Aile", "Eğitim", "Etkinlik"]
      },
      events
    });
  }

  if (req.method === "POST" && url.pathname === "/api/export/pdf") {
    const body = await readBody(req);
    const layout = ["a4", "tabloid", "booklet"].includes(body.layout) ? body.layout : "a4";
    const submittedArticles = Array.isArray(body.articles) ? body.articles : [];
    const articleIds = Array.isArray(body.articleIds) ? body.articleIds.map(String) : [];
    const dbArticles = db.articles.filter((article) => !articleIds.length || articleIds.includes(String(article.id)));
    const articles = submittedArticles.length ? submittedArticles : dbArticles;
    if (!articles.length) return json(res, 400, { error: "PDF oluşturmak için en az bir haber seçilmelidir." });
    const hidden = new Set(db.hiddenEvents.filter((item) => item.userId === userId).map((item) => item.eventId));
    const events = db.institutionalEvents
      .filter((event) => !hidden.has(event.id))
      .slice(0, 4);
    const user = db.users.find((item) => item.id === userId);
    const username = user?.name || "Kullanici";
    const dateLabel = new Date().toLocaleDateString("tr-TR");
    const content = await buildSimplePdf({
      title: `${username}'in ${dateLabel} tarihli gazetesi`,
      layout,
      articles,
      events
    });
    return pdf(res, `kisisel-gazetem-${layout}.pdf`, content);
  }

  const eventDetailMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (req.method === "GET" && eventDetailMatch) {
    let liveEvents = [];
    try { liveEvents = await fetchBiletixEvents({ city: process.env.EVENT_CITY || "ISTANBUL", limit: 80 }); } catch { liveEvents = fallbackLiveTicketEvents(); }
    const event = liveEvents.find((item) => item.id === eventDetailMatch[1]);
    if (!event) return json(res, 404, { error: "Etkinlik bulunamadı." });
    return json(res, 200, { event: decorateEvent(db, userId, event) });
  }

  const eventReadMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/read$/);
  if (req.method === "POST" && eventReadMatch) {
    const eventId = eventReadMatch[1];
    db.eventReadStatus = db.eventReadStatus.filter((item) => !(item.userId === userId && item.eventId === eventId));
    db.eventReadStatus.push({ userId, eventId, updatedAt: new Date().toISOString() });
    writeDb(db);
    return json(res, 200, { read: true });
  }

  const eventReminderMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/reminder$/);
  if (req.method === "POST" && eventReminderMatch) {
    const eventId = eventReminderMatch[1];
    const existing = db.eventReminders.find((item) => item.userId === userId && item.eventId === eventId);
    if (existing) {
      db.eventReminders = db.eventReminders.filter((item) => !(item.userId === userId && item.eventId === eventId));
    } else {
      db.eventReminders.push({ userId, eventId, createdAt: new Date().toISOString() });
    }
    writeDb(db);
    return json(res, 200, { reminder: !existing });
  }

  const eventDismissMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/dismiss$/);
  if (req.method === "POST" && eventDismissMatch) {
    const eventId = eventDismissMatch[1];
    if (!db.hiddenEvents.some((item) => item.userId === userId && item.eventId === eventId)) {
      db.hiddenEvents.push({ userId, eventId, createdAt: new Date().toISOString() });
    }
    writeDb(db);
    return json(res, 200, { hidden: true });
  }

  if (req.method === "POST" && url.pathname === "/api/integrations/test/news") {
    const config = getNewsProviderEndpoint(3);
    if (!config) {
      return json(res, 400, { error: "Haber API key bulunamadı. .env içine GNEWS_API_KEY, NEWS_API_KEY veya MEDIASTACK_API_KEY ekle." });
    }
    const payload = await fetchJson(config.endpoint, config.provider === "freenewsapi" ? {
      headers: {
        "x-api-key": process.env.FREENEWSAPI_KEY
      }
    } : {});
    return json(res, 200, {
      provider: config.provider,
      articles: normalizeProviderArticles(config.provider, payload)
        .slice(0, 3)
    });

    let provider;
    let endpoint;
    if (hasEnv("GNEWS_API_KEY")) {
      provider = "gnews";
      endpoint = `https://gnews.io/api/v4/top-headlines?lang=tr&max=3&apikey=${encodeURIComponent(process.env.GNEWS_API_KEY)}`;
    } else if (hasEnv("NEWS_API_KEY")) {
      provider = "newsapi";
      endpoint = `https://newsapi.org/v2/top-headlines?language=en&pageSize=3&apiKey=${encodeURIComponent(process.env.NEWS_API_KEY)}`;
    } else if (hasEnv("MEDIASTACK_API_KEY")) {
      provider = "mediastack";
      endpoint = `http://api.mediastack.com/v1/news?languages=tr&limit=3&access_key=${encodeURIComponent(process.env.MEDIASTACK_API_KEY)}`;
    } else {
      return json(res, 400, { error: "Haber API key bulunamadı. .env içine GNEWS_API_KEY, NEWS_API_KEY veya MEDIASTACK_API_KEY ekle." });
    }

    const legacyPayload = await fetchJson(endpoint);
    return json(res, 200, {
      provider,
      articles: normalizeProviderArticles(provider, legacyPayload).slice(0, 3)
    });
  }

  if (req.method === "POST" && url.pathname === "/api/integrations/test/ai") {
    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      return json(res, 400, { error: "GEMINI_API_KEY bulunamadı. .env içine GEMINI_API_KEY ekle." });
    }
    const model = getGeminiModel();
    const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Bu entegrasyon testi için tek cümlelik Türkçe bir haber özeti yaz." }]
          }
        ],
        generationConfig: geminiGenerationConfig({ model, maxOutputTokens: 512 })
      })
    });
    return json(res, 200, {
      provider: "gemini",
      model,
      message: payload.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "Gemini cevap verdi."
    });

    if (!hasEnv("OPENAI_API_KEY")) {
      return json(res, 400, { error: "OPENAI_API_KEY bulunamadı. .env içine ekle." });
    }

    const legacyOpenAiPayload = await fetchJson("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Kısa, net Türkçe cevap ver." },
          { role: "user", content: "Bu entegrasyon testi için tek cümlelik bir haber özeti yaz." }
        ],
        temperature: 0.2,
        max_tokens: 80
      })
    });

    return json(res, 200, {
      model: legacyOpenAiPayload.model,
      message: legacyOpenAiPayload.choices?.[0]?.message?.content || "AI cevap verdi."
    });
  }

  if (req.method === "POST" && url.pathname === "/api/entities/info") {
    const body = await readBody(req);
    const entity = String(body.entity || "").trim().slice(0, 120);
    if (!entity) return json(res, 400, { error: "Bilgi kartı için konu adı gerekli." });
    const relatedArticles = Array.isArray(body.relatedArticles) ? body.relatedArticles : [];
    const info = await generateEntityInfo(entity, relatedArticles);
    return json(res, 200, info);
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req);
    if (!body.name || !body.email || !body.password) {
      return json(res, 400, { error: "Ad, e-posta ve şifre zorunludur." });
    }
    if (db.users.some((user) => user.email === body.email)) {
      return json(res, 409, { error: "Bu e-posta zaten kayıtlı." });
    }
    const id = `user_${crypto.randomUUID()}`;
    const password = hashPassword(body.password);
    const user = {
      id,
      name: body.name,
      email: body.email,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(body.interests) || body.interests.length < 3) {
      return json(res, 400, { error: "En az 3 ilgi alanı seçmelisin." });
    }
    db.users.push(user);
    db.preferences[id] = normalizePreferences({
      interests: body.interests,
      readingGoal: body.readingGoal,
      readingTimes: body.readingTimes,
      contentDepth: body.contentDepth
    });
    writeDb(db);
    return json(res, 201, { token: createToken(id), user: { id, name: user.name, email: user.email } });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.email === body.email);
    if (!user) return json(res, 401, { error: "E-posta veya şifre hatalı." });
    if (user.passwordHash === "demo") {
      const demoHash = hashPassword("demo123");
      user.passwordHash = demoHash.hash;
      user.passwordSalt = demoHash.salt;
      writeDb(db);
    }
    const password = hashPassword(body.password || "", user.passwordSalt);
    if (password.hash !== user.passwordHash) return json(res, 401, { error: "E-posta veya şifre hatalı." });
    return json(res, 200, { token: createToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
  }

  if (req.method === "GET" && url.pathname === "/api/profile") {
    const user = db.users.find((item) => item.id === userId);
    return json(res, 200, {
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      preferences: normalizePreferences(db.preferences[userId])
    });
  }

  if (req.method === "PUT" && url.pathname === "/api/profile") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.id === userId);
    if (!user) return json(res, 404, { error: "Kullanıcı bulunamadı." });
    const name = String(body.name || "").trim();
    if (!name) return json(res, 400, { error: "Ad soyad zorunludur." });
    user.name = name;
    if (body.email) user.email = String(body.email).trim();
    writeDb(db);
    return json(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
  }

  if (req.method === "PUT" && url.pathname === "/api/profile/preferences") {
    const body = await readBody(req);
    db.preferences[userId] = normalizePreferences({
      interests: body.interests || [],
      preferredSources: body.preferredSources || [],
      readingTimes: body.readingTimes,
      contentDepth: body.contentDepth,
      readingMode: body.readingMode || "daily",
      language: body.language || "tr",
      notifications: body.notifications,
      darkMode: body.darkMode,
      fontScale: body.fontScale,
      readingGoal: body.readingGoal
    });
    writeDb(db);
    return json(res, 200, { preferences: db.preferences[userId] });
  }

  if (req.method === "GET" && url.pathname === "/api/articles") {
    const articles = db.articles.map((article) => decorateArticle(db, userId, article));
    return json(res, 200, { articles });
  }

  if (req.method === "GET" && url.pathname === "/api/feed") {
    const preferences = db.preferences[userId];
    const [apiArticles, rssArticles] = await Promise.all([
      withTimeout(fetchNewsProviderArticles(40), 8000, []),
      withTimeout(fetchRssArticles(120), 8000, [])
    ]);
    const externalArticles = [
      ...apiArticles,
      ...rssArticles.filter((article) => !apiArticles.some((apiArticle) => apiArticle.sourceUrl === article.sourceUrl))
    ];
    const externalUrls = new Set(externalArticles.map((article) => article.sourceUrl).filter(Boolean));
    const allArticles = [
      ...externalArticles,
      ...db.articles.filter((article) => !article.sourceUrl || !externalUrls.has(article.sourceUrl))
    ];
    const readingProfile = buildReadingProfile(db, userId, allArticles);
    const rankedArticles = allArticles
      .map((article) => ({
        ...decorateArticle(db, userId, article),
        relevance: scoreArticle(article, preferences, readingProfile)
      }))
      .sort((a, b) => {
        if (a.externalProvider && !b.externalProvider) return -1;
        if (!a.externalProvider && b.externalProvider) return 1;
        return b.relevance - a.relevance || new Date(b.publishedAt) - new Date(a.publishedAt);
      });
    for (const article of rankedArticles) {
      ARTICLE_CACHE.set(String(article.id), article);
    }
    const articles = dedupeFeedArticles(rankedArticles, 120);
    return json(res, 200, { articles });
  }

  if (req.method === "GET" && url.pathname === "/api/search") {
    const query = normalizeText(url.searchParams.get("q"));
    const category = url.searchParams.get("category");
    const source = url.searchParams.get("source");
    const articles = db.articles
      .filter((article) => !query || normalizeText(`${article.title} ${article.summary} ${article.fullText}`).includes(query))
      .filter((article) => !category || category === "Tümü" || article.category === category)
      .filter((article) => !source || source === "Tümü" || article.sourceName === source)
      .map((article) => decorateArticle(db, userId, article));
    return json(res, 200, { articles });
  }

  const articleDetailMatch = url.pathname.match(/^\/api\/articles\/([^/]+)$/);
  if (req.method === "GET" && articleDetailMatch) {
    const article = db.articles.find((item) => item.id === articleDetailMatch[1]) || ARTICLE_CACHE.get(articleDetailMatch[1]);
    if (!article) return json(res, 404, { error: "Haber bulunamadı." });
    const enrichedArticle = await fetchArticleFullText(article);
    ARTICLE_CACHE.set(String(enrichedArticle.id), enrichedArticle);
    return json(res, 200, {
      article: {
        ...decorateArticle(db, userId, enrichedArticle),
        aiSummary: articleSummary(enrichedArticle),
        duplicates: await findDuplicates(db, enrichedArticle)
      }
    });
  }

  const bookmarkMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/bookmark$/);
  if (req.method === "POST" && bookmarkMatch) {
    const articleId = bookmarkMatch[1];
    const existing = db.bookmarks.find((item) => item.userId === userId && item.articleId === articleId);
    if (existing) {
      db.bookmarks = db.bookmarks.filter((item) => !(item.userId === userId && item.articleId === articleId));
    } else {
      db.bookmarks.push({ userId, articleId, createdAt: new Date().toISOString() });
    }
    writeDb(db);
    return json(res, 200, { bookmarked: !existing });
  }

  const readMatch = url.pathname.match(/^\/api\/articles\/([^/]+)\/read$/);
  if (req.method === "POST" && readMatch) {
    const body = await readBody(req);
    const articleId = readMatch[1];
    db.readStatus = db.readStatus.filter((item) => !(item.userId === userId && item.articleId === articleId));
    db.readStatus.push({
      userId,
      articleId,
      status: body.status === "unread" ? "unread" : "read",
      updatedAt: new Date().toISOString()
    });
    db.userArticleEvents.push({
      id: `evt_${crypto.randomUUID()}`,
      userId,
      articleId,
      eventType: body.status === "unread" ? "mark_unread" : "mark_read",
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    return json(res, 200, { status: body.status === "unread" ? "Okunmadı" : "Okundu" });
  }

  if (req.method === "POST" && url.pathname === "/api/ingest/mock") {
    const body = await readBody(req);
    const articles = Array.isArray(body.articles) ? body.articles : [];
    let inserted = 0;
    for (const raw of articles) {
      if (!raw.title || !raw.fullText || !raw.sourceUrl) continue;
      const article = {
        id: raw.id || `art_${crypto.randomUUID()}`,
        title: raw.title,
        summary: raw.summary || raw.fullText.slice(0, 180),
        fullText: raw.fullText,
        category: raw.category || "Genel",
        tags: raw.tags || [],
        sourceName: raw.sourceName || "Bilinmeyen Kaynak",
        sourceUrl: raw.sourceUrl,
        imageUrl: raw.imageUrl || "",
        author: raw.author || "",
        publishedAt: raw.publishedAt || new Date().toISOString(),
        aiSummary: raw.aiSummary || "",
        contentHash: ""
      };
      article.contentHash = contentHash(article);
      if (db.articles.some((item) => item.contentHash === article.contentHash || item.sourceUrl === article.sourceUrl)) continue;
      const duplicate = db.articles.find((item) => similarity(`${item.title} ${item.summary}`, `${article.title} ${article.summary}`) >= 0.45);
      article.duplicateGroupId = duplicate?.duplicateGroupId || duplicate?.id || null;
      db.articles.push(article);
      inserted += 1;
    }
    db.ingestionRuns = db.ingestionRuns || [];
    db.ingestionRuns.push({
      id: `run_${crypto.randomUUID()}`,
      provider: "mock",
      status: "completed",
      fetchedCount: inserted,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });
    writeDb(db);
    return json(res, 201, { inserted });
  }

  return json(res, 404, { error: "API bulunamadı." });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_ROOT, requested));
  if (!filePath.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") return json(res, 204, {});
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (error) {
    json(res, 500, { error: error.message || "Sunucu hatası." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} zaten kullaniliyor.`);
    console.error(`Tarayicida ac: http://localhost:${PORT}`);
    console.error("Yeni bir server baslatmak icin once mevcut node surecini kapat veya .env icinde PORT degerini degistir.");
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Kişisel Gazetem çalışıyor: http://localhost:${PORT}`);
});
