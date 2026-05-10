require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

const ADMIN_KEY = process.env.ADMIN_KEY || (IS_PRODUCTION ? "" : "joel-dev");
if (IS_PRODUCTION && !ADMIN_KEY) {
  console.error("ERROR: ADMIN_KEY es obligatorio en producción.");
  process.exit(1);
}

const APP_NAME = process.env.APP_NAME || "JoelCashKing";
const CACHE_VERSION = process.env.CACHE_VERSION || "joelcashking-v22";
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

// URL pública del offerwall/encuestas.
// Puedes usar tokens: {{USER_ID}}, {{USERNAME}}, {{EMAIL}}, {{PUBLIC_URL}}
const OFFERWALL_URL = process.env.OFFERWALL_URL || "";
const OFFERWALL_NAME = process.env.OFFERWALL_NAME || "Offerway";

const REQUIRED_ADS_PER_REWARD = Number(process.env.REQUIRED_ADS_PER_REWARD || 5);

const AYET_PLACEMENT_ID = process.env.AYET_PLACEMENT_ID || "";
const AYET_ADSLOT_NAME = process.env.AYET_ADSLOT_NAME || "";
const AYET_OPTIONAL_PARAMETER = process.env.AYET_OPTIONAL_PARAMETER || "";
const AYET_API_KEY = process.env.AYET_API_KEY || "";
const AYET_REWARD_MODE = ["client", "s2s"].includes(String(process.env.AYET_REWARD_MODE || "").toLowerCase())
  ? String(process.env.AYET_REWARD_MODE).toLowerCase()
  : "s2s";

const DIRECT_AD_URL = process.env.DIRECT_AD_URL || "";
const DIRECT_AD_WAIT_SECONDS = Number(process.env.DIRECT_AD_WAIT_SECONDS || 30);
const DIRECT_AD_COOLDOWN_SECONDS = Number(process.env.DIRECT_AD_COOLDOWN_SECONDS || 180);
const DIRECT_AD_REWARD_COINS = Number(process.env.DIRECT_AD_REWARD_COINS || 5);

const BITLABS_TOKEN = process.env.BITLABS_TOKEN || process.env.BITLABS_API_TOKEN || "";
const BITLABS_APP_SECRET = process.env.BITLABS_APP_SECRET || "";
const BITLABS_BASE_URL = process.env.BITLABS_BASE_URL || "https://web.bitlabs.ai/";
const BITLABS_DEFAULT_REWARD_COINS = Number(process.env.BITLABS_DEFAULT_REWARD_COINS || 0);
const BITLABS_MAX_REWARD_COINS = Number(process.env.BITLABS_MAX_REWARD_COINS || 50000);

const TASK_UPLOAD_MAX_BYTES = Number(process.env.TASK_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const TASK_UPLOAD_ALLOWED_MIMES = ["application/pdf", "image/png", "image/jpeg"];

function sanitizeDirectAdId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function buildDirectAdLinks() {
  const links = [];

  for (let i = 1; i <= 10; i++) {
    const url = process.env[`DIRECT_AD_LINK_${i}_URL`];
    if (!url) continue;

    links.push({
      id: sanitizeDirectAdId(process.env[`DIRECT_AD_LINK_${i}_ID`] || `direct${i}`),
      name: String(process.env[`DIRECT_AD_LINK_${i}_NAME`] || `Direct Ad ${i}`).slice(0, 60),
      description: String(process.env[`DIRECT_AD_LINK_${i}_DESCRIPTION`] || "Oferta externa del proveedor").slice(0, 120),
      url: String(url),
      rewardCoins: Number(process.env[`DIRECT_AD_LINK_${i}_REWARD_COINS`] || DIRECT_AD_REWARD_COINS),
      waitSeconds: Number(process.env[`DIRECT_AD_LINK_${i}_WAIT_SECONDS`] || DIRECT_AD_WAIT_SECONDS),
      cooldownSeconds: Number(process.env[`DIRECT_AD_LINK_${i}_COOLDOWN_SECONDS`] || DIRECT_AD_COOLDOWN_SECONDS)
    });
  }

  if (!links.length && DIRECT_AD_URL) {
    links.push({
      id: "direct1",
      name: "Direct Ad 1",
      description: "Oferta externa del proveedor",
      url: DIRECT_AD_URL,
      rewardCoins: DIRECT_AD_REWARD_COINS,
      waitSeconds: DIRECT_AD_WAIT_SECONDS,
      cooldownSeconds: DIRECT_AD_COOLDOWN_SECONDS
    });
  }

  const seen = new Set();
  return links
    .filter(link => link.id && link.url)
    .filter(link => {
      if (seen.has(link.id)) return false;
      seen.add(link.id);
      return true;
    });
}

function getDirectAdLinks() {
  return buildDirectAdLinks();
}

function getDirectAdLink(linkId) {
  const links = getDirectAdLinks();
  const cleanId = sanitizeDirectAdId(linkId) || (links[0] && links[0].id);
  return links.find(link => link.id === cleanId) || null;
}

function defaultOnlineTasks() {
  return [
    {
      id: "visit-web",
      title: "Visitar una web y revisar contenido",
      description: "Entra en la web indicada, navega durante unos minutos y envía una breve opinión.",
      instructions: "Abre el enlace de la tarea, revisa la página y escribe una prueba con lo que has visto.",
      rewardCoins: Number(process.env.TASK_VISIT_WEB_REWARD || 25),
      estimatedTime: "3-5 min",
      category: "Revisión web",
      proofFileRequired: false,
      isActive: true
    },
    {
      id: "survey-profile",
      title: "Completar perfil de encuestas",
      description: "Completa o actualiza tu perfil para recibir mejores encuestas.",
      instructions: "Completa el perfil y envía una captura o explicación de la acción realizada.",
      rewardCoins: Number(process.env.TASK_SURVEY_PROFILE_REWARD || 40),
      estimatedTime: "5-8 min",
      category: "Encuestas",
      proofFileRequired: false,
      isActive: true
    },
    {
      id: "social-feedback",
      title: "Dar feedback sobre JoelCashKing",
      description: "Prueba una sección de la app y explica qué mejorarías.",
      instructions: "Usa la app durante unos minutos y escribe un feedback claro y útil.",
      rewardCoins: Number(process.env.TASK_FEEDBACK_REWARD || 30),
      estimatedTime: "4-6 min",
      category: "Feedback",
      proofFileRequired: false,
      isActive: true
    },
    {
      id: "daily-check",
      title: "Check diario de recompensas",
      description: "Revisa si hay nuevas encuestas, Direct Ads o tareas disponibles.",
      instructions: "Entra en las secciones de recompensas y confirma qué has revisado.",
      rewardCoins: Number(process.env.TASK_DAILY_CHECK_REWARD || 10),
      estimatedTime: "2 min",
      category: "Diaria",
      proofFileRequired: false,
      isActive: true
    }
  ];
}

function ensureOnlineTasks(db) {
  db.onlineTasks = db.onlineTasks || [];

  if (!db.onlineTasks.length) {
    db.onlineTasks = defaultOnlineTasks().map(task => ({
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    saveDb(db);
  }

  return db.onlineTasks;
}

function getOnlineTasks(db, includeInactive = false) {
  const tasks = ensureOnlineTasks(db);
  return tasks
    .filter(task => includeInactive || task.isActive !== false)
    .map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      instructions: task.instructions,
      rewardCoins: Number(task.rewardCoins || 0),
      estimatedTime: task.estimatedTime || "",
      category: task.category || "General",
      proofFileRequired: Boolean(task.proofFileRequired || false),
      isActive: task.isActive !== false,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));
}

function getOnlineTask(db, taskId) {
  return getOnlineTasks(db, true).find(task => task.id === String(taskId || "")) || null;
}

function publicTaskSubmission(submission) {
  return {
    id: submission.id,
    taskId: submission.taskId,
    taskTitle: submission.taskTitle,
    username: submission.username,
    rewardCoins: submission.rewardCoins,
    proofText: submission.proofText,
    proofUrl: submission.proofUrl,
    proofFile: submission.proofFile || null,
    status: submission.status,
    adminNote: submission.adminNote || "",
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt
  };
}

function sanitizeTaskId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function sanitizeUploadFileName(name) {
  return String(name || "archivo")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .slice(0, 120) || "archivo";
}

function parseProofFile(file) {
  if (!file || typeof file !== "object") return null;

  const name = sanitizeUploadFileName(file.name || "prueba");
  const mimeType = String(file.mimeType || file.type || "").trim();
  const data = String(file.data || "");

  if (!TASK_UPLOAD_ALLOWED_MIMES.includes(mimeType)) {
    throw new Error("Archivo no permitido. Solo PDF, PNG, JPG o JPEG.");
  }

  const base64 = data.includes(",") ? data.split(",").pop() : data;
  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw new Error("El archivo está vacío o no se pudo leer.");
  }

  if (buffer.length > TASK_UPLOAD_MAX_BYTES) {
    throw new Error(`El archivo supera el máximo permitido de ${Math.round(TASK_UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`);
  }

  let extension = ".bin";
  if (mimeType === "application/pdf") extension = ".pdf";
  if (mimeType === "image/png") extension = ".png";
  if (mimeType === "image/jpeg") extension = ".jpg";

  const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const storedPath = path.join(TASK_UPLOAD_DIR, storedName);

  fs.writeFileSync(storedPath, buffer);

  return {
    originalName: name,
    storedName,
    mimeType,
    sizeBytes: buffer.length,
    url: `/api/tasks/proof-file/${storedName}`
  };
}

function getFirstQuery(req, names, fallback = "") {
  for (const name of names) {
    const value = req.query[name];
    if (value !== undefined && value !== null && value !== "") {
      return Array.isArray(value) ? String(value[0] || "") : String(value);
    }
  }
  return fallback;
}

function buildPublicCallbackUrl(req) {
  if (PUBLIC_URL) return `${PUBLIC_URL.replace(/\/$/, "")}${req.originalUrl}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}${req.originalUrl}`;
}

function verifyBitLabsHash(req) {
  if (!BITLABS_APP_SECRET) return { ok: true, skipped: true };

  const hash = getFirstQuery(req, ["hash"], "");
  if (!hash) return { ok: false, error: "Falta hash de BitLabs." };

  const fullUrl = buildPublicCallbackUrl(req);
  let unsignedUrl = fullUrl;
  if (fullUrl.includes("&hash=")) unsignedUrl = fullUrl.split("&hash=")[0];
  else if (fullUrl.includes("?hash=")) unsignedUrl = fullUrl.split("?hash=")[0];
  else return { ok: false, error: "No se pudo separar el hash de la URL." };

  const expected = crypto.createHmac("sha1", BITLABS_APP_SECRET).update(unsignedUrl).digest("hex");

  try {
    const a = Buffer.from(String(hash), "hex");
    const b = Buffer.from(String(expected), "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Hash de BitLabs no válido." };
    }
  } catch {
    return { ok: false, error: "Hash de BitLabs con formato inválido." };
  }

  return { ok: true };
}

function parseBitLabsReward(req) {
  const uid = getFirstQuery(req, ["UID", "uid", "user_id", "userId", "player_id", "subId"]);
  const tx = getFirstQuery(req, ["TX", "TXID", "tx", "txid", "transaction_id", "transactionId", "REF", "ref"]);
  const val = getFirstQuery(req, ["VAL", "val", "amount", "currency_amount", "reward", "points"]);
  const raw = getFirstQuery(req, ["RAW", "raw", "USD", "usd", "payout"]);
  const type = getFirstQuery(req, ["TYPE", "type", "activity_type", "state"], "COMPLETE");
  const offerId = getFirstQuery(req, ["OFFER_ID", "offer_id", "SURVEY_ID", "survey_id"]);
  const offerName = getFirstQuery(req, ["OFFER_NAME", "offer_name", "goal_name"]);

  const rewardNumber = Number(val || BITLABS_DEFAULT_REWARD_COINS || 0);
  const rewardCoins = Math.max(0, Math.min(Math.floor(rewardNumber), BITLABS_MAX_REWARD_COINS));

  return { uid, tx, val, raw, type, offerId, offerName, rewardCoins };
}

function isBitLabsRewardableType(type) {
  const clean = String(type || "").toUpperCase();
  if (!clean) return true;
  return ["COMPLETE", "COMPLETED", "START_BONUS", "PENDING", "NONE"].includes(clean);
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const TASK_UPLOAD_DIR = path.join(DATA_DIR, "task-uploads");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TASK_UPLOAD_DIR, { recursive: true });
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

app.use(cors({
  origin: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(",").map(item => item.trim()) : true,
  credentials: true
}));

app.use(express.json({ limit: "250kb" }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera un poco y prueba otra vez." }
});

const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes de retiro. Espera un poco." }
});

app.use(generalLimiter);

app.use((req, res, next) => {
  const pathName = req.path || "";

  const shouldNoStore =
    pathName.startsWith("/api/") ||
    pathName === "/health" ||
    pathName === "/" ||
    pathName === "/sw.js" ||
    pathName.endsWith(".html") ||
    pathName.endsWith(".js") ||
    pathName.endsWith(".css");

  if (shouldNoStore) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }

  next();
});

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: false,
  lastModified: false
}));

function initialDb() {
  return {
    users: {},
    withdrawals: [],
    rewardedVideoConversions: {},
    ayetS2SCallbacks: {},
    bitlabsCallbacks: {},
    bitlabsTransactions: {},
    taskSubmissions: [],
    onlineTasks: [],
    settings: {
      minWithdrawalCoins: 1000,
      coinRate: 1000,
      currency: "EUR"
    }
  };
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: APP_NAME,
    env: NODE_ENV,
    publicUrl: PUBLIC_URL || null,
    requiredAdsPerReward: REQUIRED_ADS_PER_REWARD,
    ayetConfigured: Boolean(AYET_PLACEMENT_ID && AYET_ADSLOT_NAME),
    ayetRewardMode: AYET_REWARD_MODE,
    ayetCallbackUrl: PUBLIC_URL ? `${PUBLIC_URL}/api/ayet/s2s-callback` : null,
    directAdConfigured: getDirectAdLinks().length > 0,
    directAdLinksCount: getDirectAdLinks().length,
    directAdRewardCoins: DIRECT_AD_REWARD_COINS,
    directAdWaitSeconds: DIRECT_AD_WAIT_SECONDS,
    directAdCooldownSeconds: DIRECT_AD_COOLDOWN_SECONDS,
    bitlabsConfigured: Boolean(BITLABS_TOKEN),
    bitlabsCallbackUrl: PUBLIC_URL ? `${PUBLIC_URL}/api/bitlabs/callback` : null,
    time: new Date().toISOString()
  });
});

app.get("/version", (req, res) => {
  res.json({
    app: APP_NAME,
    version: "0.22.0",
    cache: CACHE_VERSION || "joelcashking-v22",
    time: new Date().toISOString()
  });
});

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const data = initialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.users = db.users || {};
  db.withdrawals = db.withdrawals || [];
  db.rewardedVideoConversions = db.rewardedVideoConversions || {};
  db.ayetS2SCallbacks = db.ayetS2SCallbacks || {};
  db.bitlabsCallbacks = db.bitlabsCallbacks || {};
  db.bitlabsTransactions = db.bitlabsTransactions || {};
  db.taskSubmissions = db.taskSubmissions || [];
  db.onlineTasks = db.onlineTasks || [];
  db.settings = db.settings || initialDb().settings;
  return db;
}

function saveDb(db) {
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

function sanitizeUsername(username) {
  return String(username || "")
    .trim()
    .replace(/[^\wÀ-ÿ ._-]/g, "")
    .slice(0, 28);
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase().slice(0, 120);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, "sha512")
    .toString("hex");

  return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
  const candidate = hashPassword(password, salt).passwordHash;
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(passwordHash, "hex"));
}

function publicUser(user, db) {
  user.stats = user.stats || {};
  user.stats.coinsEarned = user.stats.coinsEarned ?? user.coins ?? 0;
  user.stats.quizSolved = user.stats.quizSolved || 0;
  user.stats.wordSearchSolved = user.stats.wordSearchSolved || 0;
  user.stats.adsWatched = user.stats.adsWatched || 0;
  user.stats.unityAdsWatched = user.stats.unityAdsWatched || 0;
  user.stats.spins = user.stats.spins || 0;
  user.stats.withdrawalsRequested = user.stats.withdrawalsRequested || 0;
  user.stats.puzzlesCompleted = user.stats.puzzlesCompleted || 0;
  user.stats.puzzleUnityAdsWatched = user.stats.puzzleUnityAdsWatched || 0;
  user.stats.directAdsCompleted = user.stats.directAdsCompleted || 0;
  user.stats.bitlabsCompleted = user.stats.bitlabsCompleted || 0;
  user.stats.bitlabsCoins = user.stats.bitlabsCoins || 0;
  user.stats.tasksSubmitted = user.stats.tasksSubmitted || 0;
  user.stats.tasksApproved = user.stats.tasksApproved || 0;
  user.stats.taskCoins = user.stats.taskCoins || 0;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    coins: user.coins,
    createdAt: user.createdAt,
    stats: user.stats,
    minWithdrawalCoins: db.settings.minWithdrawalCoins,
    coinRate: db.settings.coinRate,
    currency: db.settings.currency
  };
}

function authUser(req, res, next) {
  const db = loadDb();
  const token = String(req.headers.authorization || "").replace("Bearer ", "");
  const user = Object.values(db.users).find(u => u.token === token);

  if (!user) {
    return res.status(401).json({ error: "Sesión no válida. Inicia sesión otra vez." });
  }

  req.db = db;
  req.user = user;
  next();
}

function adminOnly(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Clave de administrador incorrecta." });
  }
  next();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDaily(user) {
  const key = todayKey();
  user.daily = user.daily || {};
  user.daily[key] = user.daily[key] || {
    ads: 0,
    spins: 0,
    rouletteUnityAds: 0,
    extraSpins: 0,
    quiz: 0,
    wordSearch: 0,
    puzzleCompletedAt: 0,
    puzzleUnityAdReady: false,
    rewardedAdProgress: {
      coins: 0,
      roulette: 0,
      puzzle: 0
    },
    directAdStartedAt: 0,
    directAdLastRewardAt: 0,
    directAds: {}
  };
  user.daily[key].ads = user.daily[key].ads || 0;
  user.daily[key].spins = user.daily[key].spins || 0;
  user.daily[key].rouletteUnityAds = user.daily[key].rouletteUnityAds || 0;
  user.daily[key].extraSpins = user.daily[key].extraSpins || 0;
  user.daily[key].quiz = user.daily[key].quiz || 0;
  user.daily[key].wordSearch = user.daily[key].wordSearch || 0;
  user.daily[key].puzzleCompletedAt = user.daily[key].puzzleCompletedAt || 0;
  user.daily[key].puzzleUnityAdReady = Boolean(user.daily[key].puzzleUnityAdReady || false);
  user.daily[key].rewardedAdProgress = user.daily[key].rewardedAdProgress || {};
  user.daily[key].rewardedAdProgress.coins = user.daily[key].rewardedAdProgress.coins || 0;
  user.daily[key].rewardedAdProgress.roulette = user.daily[key].rewardedAdProgress.roulette || 0;
  user.daily[key].rewardedAdProgress.puzzle = user.daily[key].rewardedAdProgress.puzzle || 0;
  user.daily[key].directAdStartedAt = user.daily[key].directAdStartedAt || 0;
  user.daily[key].directAdLastRewardAt = user.daily[key].directAdLastRewardAt || 0;
  user.daily[key].directAds = user.daily[key].directAds || {};
  return user.daily[key];
}

function normalizeRewardPurpose(purpose) {
  const clean = String(purpose || "").trim().toLowerCase();
  if (["coins", "roulette", "puzzle"].includes(clean)) return clean;
  return "";
}

function rewardedProgressPayload(daily, purpose) {
  const progress = daily.rewardedAdProgress[purpose] || 0;

  return {
    purpose,
    progress,
    required: REQUIRED_ADS_PER_REWARD,
    remaining: Math.max(0, REQUIRED_ADS_PER_REWARD - progress),
    ready: progress >= REQUIRED_ADS_PER_REWARD
  };
}

function consumeRewardedAds(daily, purpose) {
  const progress = daily.rewardedAdProgress[purpose] || 0;

  if (progress < REQUIRED_ADS_PER_REWARD) {
    return false;
  }

  daily.rewardedAdProgress[purpose] = Math.max(0, progress - REQUIRED_ADS_PER_REWARD);
  return true;
}

function incrementRewardedAdStats(user, purpose) {
  user.stats = user.stats || {};

  if (purpose === "coins") {
    user.stats.adsWatched = (user.stats.adsWatched || 0) + 1;
  }

  if (purpose === "roulette") {
    user.stats.unityAdsWatched = (user.stats.unityAdsWatched || 0) + 1;
  }

  if (purpose === "puzzle") {
    user.stats.puzzleUnityAdsWatched = (user.stats.puzzleUnityAdsWatched || 0) + 1;
  }
}

function verifyAyetClientReward(details, userId) {
  if (!details || typeof details !== "object") {
    return { ok: false, error: "Respuesta de vídeo inválida." };
  }

  if (String(details.status || "").toLowerCase() !== "success") {
    return { ok: false, error: "El vídeo no fue marcado como completado." };
  }

  if (details.rewarded !== true && String(details.rewarded) !== "true") {
    return { ok: false, error: "El vídeo no fue recompensado." };
  }

  if (String(details.externalIdentifier || "") !== String(userId)) {
    return { ok: false, error: "El usuario del vídeo no coincide." };
  }

  const conversionId = String(details.conversionId || "");
  if (!conversionId || conversionId.length < 8) {
    return { ok: false, error: "Falta conversionId del vídeo." };
  }

  if (AYET_API_KEY && details.signature) {
    const customParts = ["custom_1", "custom_2", "custom_3", "custom_4", "custom_5"]
      .map(key => details[key] ? String(details[key]) : "")
      .join("");

    const raw = String(details.externalIdentifier || "") +
      String(details.currency || "") +
      conversionId +
      customParts;

    const expected = crypto
      .createHmac("sha1", AYET_API_KEY)
      .update(raw)
      .digest("hex");

    if (String(details.signature) !== expected) {
      return { ok: false, error: "Firma de ayeT no válida." };
    }
  }

  return { ok: true, conversionId };
}

function getQueryValue(query, key) {
  const value = query[key];
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function buildAyetSecurityBaseString(query) {
  return Object.keys(query)
    .sort()
    .map(key => {
      const value = Array.isArray(query[key]) ? query[key][0] : query[key];
      return `${key}=${String(value ?? "")}`;
    })
    .join("&");
}

function verifyAyetS2SHash(req) {
  if (!AYET_API_KEY) {
    return { ok: true, skipped: true };
  }

  const received = String(req.get("X-Ayetstudios-Security-Hash") || "").trim();
  if (!received) {
    return { ok: false, error: "Falta header X-Ayetstudios-Security-Hash." };
  }

  const baseString = buildAyetSecurityBaseString(req.query);
  const expected = crypto
    .createHmac("sha256", AYET_API_KEY)
    .update(baseString)
    .digest("hex");

  try {
    const a = Buffer.from(received, "hex");
    const b = Buffer.from(expected, "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Hash S2S de ayeT no válido." };
    }
  } catch {
    return { ok: false, error: "Hash S2S de ayeT con formato inválido." };
  }

  return { ok: true };
}

function findUserByExternalIdentifier(db, externalIdentifier) {
  const value = String(externalIdentifier || "");
  return Object.values(db.users || {}).find(user =>
    String(user.id) === value ||
    String(user.username) === value ||
    String(user.email) === value
  ) || null;
}

function recordRewardedProgressFromServer(db, user, purpose, transactionId, payload, source) {
  db.rewardedVideoConversions = db.rewardedVideoConversions || {};

  if (db.rewardedVideoConversions[transactionId]) {
    return {
      ok: true,
      duplicate: true,
      progress: null
    };
  }

  const daily = ensureDaily(user);
  daily.rewardedAdProgress[purpose] = (daily.rewardedAdProgress[purpose] || 0) + 1;

  incrementRewardedAdStats(user, purpose);

  db.rewardedVideoConversions[transactionId] = {
    userId: user.id,
    username: user.username,
    purpose,
    source,
    payload,
    createdAt: new Date().toISOString()
  };

  return {
    ok: true,
    duplicate: false,
    progress: rewardedProgressPayload(daily, purpose)
  };
}

app.post("/api/register", authLimiter, (req, res) => {
  const db = loadDb();

  const username = sanitizeUsername(req.body.username);
  const normalizedUsername = username.toLowerCase();
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || "");

  if (username.length < 3) {
    return res.status(400).json({ error: "El nombre de usuario debe tener al menos 3 caracteres." });
  }

  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ error: "Introduce un email válido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  }

  const exists = Object.values(db.users).some(u =>
    u.normalizedUsername === normalizedUsername || u.emailLower === email
  );

  if (exists) {
    return res.status(409).json({ error: "Ese usuario o email ya existe." });
  }

  const id = uuidv4();
  const { salt, passwordHash } = hashPassword(password);

  const user = {
    id,
    username,
    normalizedUsername,
    email,
    emailLower: email,
    passwordSalt: salt,
    passwordHash,
    token: uuidv4(),
    coins: 100,
    createdAt: new Date().toISOString(),
    stats: {
      coinsEarned: 100,
      quizSolved: 0,
      wordSearchSolved: 0,
      adsWatched: 0,
      unityAdsWatched: 0,
      spins: 0,
      withdrawalsRequested: 0,
      puzzlesCompleted: 0,
      puzzleUnityAdsWatched: 0,
      directAdsCompleted: 0,
      bitlabsCompleted: 0,
      bitlabsCoins: 0,
      tasksSubmitted: 0,
      tasksApproved: 0,
      taskCoins: 0
    },
    daily: {}
  };

  db.users[id] = user;
  saveDb(db);

  res.json({
    token: user.token,
    user: publicUser(user, db)
  });
});

app.post("/api/login", authLimiter, (req, res) => {
  const db = loadDb();

  const identifier = String(req.body.identifier || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = Object.values(db.users).find(u =>
    u.normalizedUsername === identifier || u.emailLower === identifier
  );

  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ error: "Usuario/email o contraseña incorrectos." });
  }

  user.token = uuidv4();
  saveDb(db);

  res.json({
    token: user.token,
    user: publicUser(user, db)
  });
});

app.post("/api/logout", authUser, (req, res) => {
  req.user.token = "";
  saveDb(req.db);
  res.json({ ok: true });
});

app.get("/api/me", authUser, (req, res) => {
  res.json(publicUser(req.user, req.db));
});

app.get("/api/profile", authUser, (req, res) => {
  const user = publicUser(req.user, req.db);
  const withdrawals = req.db.withdrawals
    .filter(w => w.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    user,
    withdrawals
  });
});

app.get("/api/my-withdrawals", authUser, (req, res) => {
  const withdrawals = req.db.withdrawals
    .filter(w => w.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ withdrawals });
});

app.get("/api/ayet/config", authUser, (req, res) => {
  const configured = Boolean(AYET_PLACEMENT_ID && AYET_ADSLOT_NAME);

  res.json({
    configured,
    placementId: configured ? Number(AYET_PLACEMENT_ID) : null,
    adslotName: configured ? AYET_ADSLOT_NAME : "",
    externalIdentifier: req.user.id,
    optionalParameter: AYET_OPTIONAL_PARAMETER || "joelcashking",
    rewardMode: AYET_REWARD_MODE,
    s2sCallbackUrl: PUBLIC_URL ? `${PUBLIC_URL}/api/ayet/s2s-callback` : "",
    requiredAdsPerReward: REQUIRED_ADS_PER_REWARD
  });
});

app.get("/api/rewarded-ad/status", authUser, (req, res) => {
  const purpose = normalizeRewardPurpose(req.query.purpose);

  if (!purpose) {
    return res.status(400).json({ error: "Tipo de recompensa no válido." });
  }

  const daily = ensureDaily(req.user);

  res.json({
    ok: true,
    ...rewardedProgressPayload(daily, purpose)
  });
});

app.get("/api/ayet/s2s-callback", (req, res) => {
  const db = loadDb();
  db.ayetS2SCallbacks = db.ayetS2SCallbacks || {};
  db.bitlabsCallbacks = db.bitlabsCallbacks || {};
  db.bitlabsTransactions = db.bitlabsTransactions || {};
  db.taskSubmissions = db.taskSubmissions || [];
  db.onlineTasks = db.onlineTasks || [];

  const transactionId = getQueryValue(req.query, "transaction_id");
  const externalIdentifier = getQueryValue(req.query, "external_identifier");
  const currencyAmountRaw = getQueryValue(req.query, "currency_amount");
  const payoutUsdRaw = getQueryValue(req.query, "payout_usd");
  const callbackType = getQueryValue(req.query, "callback_type") || "conversion";
  const isChargeback = getQueryValue(req.query, "is_chargeback") === "1" || transactionId.startsWith("r-");
  const adslotId = getQueryValue(req.query, "adslot_id");
  const placementIdentifier = getQueryValue(req.query, "placement_identifier");
  const purpose = normalizeRewardPurpose(getQueryValue(req.query, "custom_1")) || "coins";

  const logId = transactionId || crypto.randomUUID();
  const payload = {
    query: req.query,
    transactionId,
    externalIdentifier,
    currencyAmount: Number(currencyAmountRaw || 0),
    payoutUsd: Number(payoutUsdRaw || 0),
    callbackType,
    isChargeback,
    adslotId,
    placementIdentifier,
    purpose,
    receivedAt: new Date().toISOString()
  };

  db.ayetS2SCallbacks[logId] = payload;

  const hashCheck = verifyAyetS2SHash(req);
  if (!hashCheck.ok) {
    db.ayetS2SCallbacks[logId].status = "rejected_hash";
    db.ayetS2SCallbacks[logId].error = hashCheck.error;
    saveDb(db);
    return res.status(200).json({ ok: false, error: hashCheck.error });
  }

  if (!transactionId) {
    db.ayetS2SCallbacks[logId].status = "rejected_missing_transaction";
    saveDb(db);
    return res.status(200).json({ ok: false, error: "Falta transaction_id." });
  }

  const user = findUserByExternalIdentifier(db, externalIdentifier);
  if (!user) {
    db.ayetS2SCallbacks[logId].status = "rejected_user_not_found";
    saveDb(db);
    return res.status(200).json({ ok: false, error: "Usuario no encontrado." });
  }

  if (isChargeback || Number(currencyAmountRaw || 0) < 0 || Number(payoutUsdRaw || 0) < 0) {
    db.ayetS2SCallbacks[logId].status = "chargeback_ignored";
    db.ayetS2SCallbacks[logId].userId = user.id;
    saveDb(db);
    return res.status(200).json({ ok: true, status: "chargeback_ignored" });
  }

  const recorded = recordRewardedProgressFromServer(
    db,
    user,
    purpose,
    transactionId,
    payload,
    "ayet_s2s"
  );

  db.ayetS2SCallbacks[logId].status = recorded.duplicate ? "duplicate" : "credited_progress";
  db.ayetS2SCallbacks[logId].userId = user.id;
  db.ayetS2SCallbacks[logId].progress = recorded.progress;

  saveDb(db);

  return res.status(200).json({
    ok: true,
    duplicate: recorded.duplicate,
    purpose,
    progress: recorded.progress
  });
});

app.post("/api/rewarded-ad/ayet-reward", authUser, (req, res) => {
  const purpose = normalizeRewardPurpose(req.body.purpose);

  if (!purpose) {
    return res.status(400).json({ error: "Tipo de recompensa no válido." });
  }

  const details = req.body.details || {};
  const verified = verifyAyetClientReward(details, req.user.id);

  if (!verified.ok) {
    return res.status(400).json({ error: verified.error });
  }

  const recorded = recordRewardedProgressFromServer(
    req.db,
    req.user,
    purpose,
    verified.conversionId,
    details,
    "ayet_client"
  );

  if (recorded.duplicate) {
    return res.status(409).json({
      error: "Este vídeo ya fue registrado antes.",
      conversionId: verified.conversionId
    });
  }

  saveDb(req.db);

  res.json({
    ok: true,
    conversionId: verified.conversionId,
    ...recorded.progress
  });
});

app.post("/api/rewarded-ad/progress", authUser, (req, res) => {
  const purpose = normalizeRewardPurpose(req.body.purpose);

  if (!purpose) {
    return res.status(400).json({ error: "Tipo de anuncio no válido." });
  }

  const daily = ensureDaily(req.user);
  daily.rewardedAdProgress[purpose] = (daily.rewardedAdProgress[purpose] || 0) + 1;

  incrementRewardedAdStats(req.user, purpose);

  saveDb(req.db);

  res.json({
    ok: true,
    ...rewardedProgressPayload(daily, purpose)
  });
});

app.post("/api/reward/ad", authUser, (req, res) => {
  const daily = ensureDaily(req.user);

  if (daily.ads >= 20) {
    return res.status(429).json({ error: "Límite diario de recompensas por anuncios alcanzado. Vuelve mañana." });
  }

  if (!consumeRewardedAds(daily, "coins")) {
    return res.status(429).json({
      error: `Necesitas ver ${REQUIRED_ADS_PER_REWARD} anuncios antes de recibir esta recompensa.`,
      ...rewardedProgressPayload(daily, "coins")
    });
  }

  daily.ads += 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + 10;
  req.user.coins += 10;
  saveDb(req.db);

  res.json({ ok: true, added: 10, coins: req.user.coins, adsLeftToday: 20 - daily.ads });
});

app.post("/api/reward/quiz", authUser, (req, res) => {
  const correct = Math.max(0, Math.min(Number(req.body.correct) || 0, Number(req.body.total) || 0));
  const added = correct * 8;

  req.user.stats.quizSolved += 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + added;
  req.user.coins += added;
  saveDb(req.db);

  res.json({ ok: true, added, coins: req.user.coins });
});

app.post("/api/reward/wordsearch", authUser, (req, res) => {
  const puzzleId = String(req.body.puzzleId || "basic").slice(0, 30);

  const rewards = {
    basic: 30,
    advanced: 30,
    easy3: 10
  };

  const reward = rewards[puzzleId] ?? 30;

  req.user.stats.wordSearchSolved += 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + reward;
  req.user.coins += reward;
  saveDb(req.db);

  res.json({
    ok: true,
    puzzleId,
    added: reward,
    coins: req.user.coins
  });
});


app.post("/api/roulette/unity-ad", authUser, (req, res) => {
  const daily = ensureDaily(req.user);

  if (daily.spins < 1) {
    return res.status(400).json({
      error: "Todavía tienes 1 tirada gratuita. Usa primero la tirada gratis."
    });
  }

  if (daily.rouletteUnityAds >= 10) {
    return res.status(429).json({
      error: "Has alcanzado el límite de avances de anuncio extra para la ruleta por hoy."
    });
  }

  if (!consumeRewardedAds(daily, "roulette")) {
    return res.status(429).json({
      error: `Necesitas ver ${REQUIRED_ADS_PER_REWARD} anuncios antes de sumar progreso para la ruleta.`,
      ...rewardedProgressPayload(daily, "roulette")
    });
  }

  daily.rouletteUnityAds += 1;

  saveDb(req.db);

  res.json({
    ok: true,
    rouletteUnityAds: daily.rouletteUnityAds,
    adsNeededForNextSpin: Math.max(0, 2 - (daily.rouletteUnityAds % 2)),
    message: "Unity Ad registrado para tirada extra."
  });
});

app.post("/api/roulette/spin", authUser, (req, res) => {
  const daily = ensureDaily(req.user);

  let spinType = "free";

  if (daily.spins >= 1) {
    if (daily.rouletteUnityAds < 2) {
      return res.status(429).json({
        error: "Has usado tu tirada gratuita de hoy. Para una tirada extra debes ver 2 anuncios de Unity Ads.",
        freeSpinsLeft: 0,
        unityAdsProgress: daily.rouletteUnityAds,
        unityAdsNeeded: 2
      });
    }

    daily.rouletteUnityAds -= 2;
    daily.extraSpins += 1;
    spinType = "unity_ads_extra";
  }

  const prizes = [0, 5, 10, 15, 20, 25, 50];
  const weights = [10, 25, 25, 18, 12, 8, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
  let prize = 0;

  for (let i = 0; i < prizes.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      prize = prizes[i];
      break;
    }
  }

  daily.spins += 1;
  req.user.stats.spins += 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + prize;
  req.user.coins += prize;
  saveDb(req.db);

  res.json({
    ok: true,
    prize,
    coins: req.user.coins,
    spinType,
    freeSpinsLeft: Math.max(0, 1 - daily.spins),
    unityAdsProgress: daily.rouletteUnityAds,
    unityAdsNeededForNextExtraSpin: Math.max(0, 2 - daily.rouletteUnityAds)
  });
});

app.post("/api/shop/withdraw-paypal", withdrawLimiter, authUser, (req, res) => {
  const paypalEmail = cleanEmail(req.body.paypalEmail);
  const coins = Math.floor(Number(req.body.coins) || 0);
  const min = req.db.settings.minWithdrawalCoins;

  if (!paypalEmail.includes("@") || !paypalEmail.includes(".")) {
    return res.status(400).json({ error: "Introduce un email de PayPal válido." });
  }

  if (coins < min) {
    return res.status(400).json({ error: `El mínimo de retirada son ${min} monedas.` });
  }

  if (coins > req.user.coins) {
    return res.status(400).json({ error: "No tienes suficientes monedas." });
  }

  req.user.coins -= coins;
  req.user.stats.withdrawalsRequested += 1;

  const withdrawal = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    method: "PayPal",
    paypalEmail,
    country: "",
    cashCity: "",
    cashContact: "",
    cashNotes: "",
    coins,
    estimatedEuro: Number((coins / req.db.settings.coinRate).toFixed(2)),
    currency: req.db.settings.currency,
    status: "pending_review",
    adminNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  req.db.withdrawals.push(withdrawal);
  saveDb(req.db);

  res.json({
    ok: true,
    coins: req.user.coins,
    withdrawal
  });
});

app.post("/api/shop/withdraw-cash-spain", withdrawLimiter, authUser, (req, res) => {
  const coins = Math.floor(Number(req.body.coins) || 0);
  const min = req.db.settings.minWithdrawalCoins;

  const country = String(req.body.country || "").trim();
  const cashCity = String(req.body.cashCity || "").trim().slice(0, 80);
  const cashContact = String(req.body.cashContact || "").trim().slice(0, 120);
  const cashNotes = String(req.body.cashNotes || "").trim().slice(0, 240);

  const normalizedCountry = country
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!["espana", "spain", "es"].includes(normalizedCountry)) {
    return res.status(400).json({
      error: "La retirada en efectivo solo está disponible para España."
    });
  }

  if (!cashCity || cashCity.length < 2) {
    return res.status(400).json({ error: "Indica la ciudad o zona de entrega en España." });
  }

  if (!cashContact || cashContact.length < 5) {
    return res.status(400).json({ error: "Indica un contacto para coordinar la entrega." });
  }

  if (coins < min) {
    return res.status(400).json({ error: `El mínimo de retirada son ${min} monedas.` });
  }

  if (coins > req.user.coins) {
    return res.status(400).json({ error: "No tienes suficientes monedas." });
  }

  req.user.coins -= coins;
  req.user.stats.withdrawalsRequested += 1;

  const withdrawal = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    method: "Efectivo España",
    paypalEmail: "",
    country: "España",
    cashCity,
    cashContact,
    cashNotes,
    coins,
    estimatedEuro: Number((coins / req.db.settings.coinRate).toFixed(2)),
    currency: req.db.settings.currency,
    status: "pending_review",
    adminNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  req.db.withdrawals.push(withdrawal);
  saveDb(req.db);

  res.json({
    ok: true,
    coins: req.user.coins,
    withdrawal
  });
});

app.post("/api/shop/withdraw-bizum", withdrawLimiter, authUser, (req, res) => {
  const coins = Math.floor(Number(req.body.coins) || 0);
  const min = req.db.settings.minWithdrawalCoins;
  const bizumName = String(req.body.bizumName || "").trim().slice(0, 100);
  const bizumPhone = String(req.body.bizumPhone || "").trim().slice(0, 30);

  if (!bizumName || bizumName.length < 2) {
    return res.status(400).json({ error: "Introduce el nombre del titular de Bizum." });
  }

  if (!bizumPhone || bizumPhone.length < 9) {
    return res.status(400).json({ error: "Introduce un teléfono válido para Bizum." });
  }

  if (coins < min) {
    return res.status(400).json({ error: `El mínimo de retirada son ${min} monedas.` });
  }

  if (coins > req.user.coins) {
    return res.status(400).json({ error: "No tienes suficientes monedas." });
  }

  req.user.coins -= coins;
  req.user.stats.withdrawalsRequested += 1;

  const withdrawal = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    method: "Bizum",
    paypalEmail: "",
    country: "España",
    cashCity: "",
    cashContact: "",
    cashNotes: "",
    bizumName,
    bizumPhone,
    coins,
    estimatedEuro: Number((coins / req.db.settings.coinRate).toFixed(2)),
    currency: req.db.settings.currency,
    status: "pending_review",
    adminNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  req.db.withdrawals.push(withdrawal);
  saveDb(req.db);

  res.json({
    ok: true,
    coins: req.user.coins,
    withdrawal
  });
});


app.post("/api/shop/withdraw-gift-card", withdrawLimiter, authUser, (req, res) => {
  const coins = Math.floor(Number(req.body.coins) || 0);
  const min = req.db.settings.minWithdrawalCoins;

  const providerKey = String(req.body.provider || "").trim().toLowerCase();
  const giftCardEmail = cleanEmail(req.body.giftCardEmail);
  const giftCardNotes = String(req.body.giftCardNotes || "").trim().slice(0, 240);

  const providers = {
    amazon: "Amazon",
    googleplay: "Google Play",
    steam: "Steam",
    apple: "Apple",
    spotify: "Spotify"
  };

  const providerName = providers[providerKey];

  if (!providerName) {
    return res.status(400).json({ error: "Tarjeta regalo no válida." });
  }

  if (!giftCardEmail.includes("@") || !giftCardEmail.includes(".")) {
    return res.status(400).json({ error: "Introduce un email válido para recibir la tarjeta regalo." });
  }

  if (coins < min) {
    return res.status(400).json({ error: `El mínimo de retirada son ${min} monedas.` });
  }

  if (coins > req.user.coins) {
    return res.status(400).json({ error: "No tienes suficientes monedas." });
  }

  req.user.coins -= coins;
  req.user.stats.withdrawalsRequested += 1;

  const withdrawal = {
    id: uuidv4(),
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    method: `Tarjeta regalo ${providerName}`,
    paypalEmail: "",
    country: "",
    cashCity: "",
    cashContact: "",
    cashNotes: "",
    bizumName: "",
    bizumPhone: "",
    giftCardProvider: providerName,
    giftCardEmail,
    giftCardNotes,
    coins,
    estimatedEuro: Number((coins / req.db.settings.coinRate).toFixed(2)),
    currency: req.db.settings.currency,
    status: "pending_review",
    adminNote: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  req.db.withdrawals.push(withdrawal);
  saveDb(req.db);

  res.json({
    ok: true,
    coins: req.user.coins,
    withdrawal
  });
});


app.get("/api/tasks", authUser, (req, res) => {
  const submissions = (req.db.taskSubmissions || [])
    .filter(item => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicTaskSubmission);

  res.json({
    tasks: getOnlineTasks(req.db),
    submissions
  });
});

app.post("/api/tasks/submit", authUser, (req, res) => {
  const task = getOnlineTask(req.db, req.body.taskId);

  if (!task) {
    return res.status(400).json({ error: "Tarea no válida." });
  }

  const proofText = String(req.body.proofText || "").trim().slice(0, 1000);
  const proofUrl = String(req.body.proofUrl || "").trim().slice(0, 300);

  let proofFile = null;

  try {
    proofFile = parseProofFile(req.body.proofFile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (task.proofFileRequired && !proofFile) {
    return res.status(400).json({ error: "Esta tarea requiere subir un archivo de prueba." });
  }

  if (proofText.length < 10 && proofUrl.length < 8 && !proofFile) {
    return res.status(400).json({ error: "Añade una prueba, explicación o archivo de la tarea realizada." });
  }

  const recentDuplicate = (req.db.taskSubmissions || []).find(item =>
    item.userId === req.user.id &&
    item.taskId === task.id &&
    ["pending_review", "approved"].includes(item.status)
  );

  if (recentDuplicate) {
    return res.status(409).json({ error: "Ya tienes una solicitud pendiente o aprobada para esta tarea." });
  }

  const submission = {
    id: uuidv4(),
    taskId: task.id,
    taskTitle: task.title,
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    rewardCoins: task.rewardCoins,
    proofText,
    proofUrl,
    proofFile,
    status: "pending_review",
    adminNote: "",
    credited: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  req.user.stats.tasksSubmitted = (req.user.stats.tasksSubmitted || 0) + 1;
  req.db.taskSubmissions.push(submission);
  saveDb(req.db);

  res.json({
    ok: true,
    submission: publicTaskSubmission(submission)
  });
});

app.get("/api/tasks/my-submissions", authUser, (req, res) => {
  const submissions = (req.db.taskSubmissions || [])
    .filter(item => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(publicTaskSubmission);

  res.json({ submissions });
});

app.get("/api/bitlabs/config", authUser, (req, res) => {
  if (!BITLABS_TOKEN) {
    return res.json({
      configured: false,
      url: "",
      message: "BitLabs no está configurado. Añade BITLABS_TOKEN en Railway."
    });
  }

  const params = new URLSearchParams({
    uid: req.user.id,
    token: BITLABS_TOKEN,
    source: "joelcashking",
    username: req.user.username
  });

  res.json({
    configured: true,
    url: `${BITLABS_BASE_URL}?${params.toString()}`,
    uid: req.user.id,
    callbackUrl: PUBLIC_URL ? `${PUBLIC_URL}/api/bitlabs/callback` : ""
  });
});

app.get("/api/bitlabs/callback", (req, res) => {
  const db = loadDb();
  db.bitlabsCallbacks = db.bitlabsCallbacks || {};
  db.bitlabsTransactions = db.bitlabsTransactions || {};
  db.taskSubmissions = db.taskSubmissions || [];
  db.onlineTasks = db.onlineTasks || [];

  const parsed = parseBitLabsReward(req);
  const logId = parsed.tx || crypto.randomUUID();
  const log = { receivedAt: new Date().toISOString(), query: req.query, parsed };
  db.bitlabsCallbacks[logId] = log;

  const hashCheck = verifyBitLabsHash(req);
  if (!hashCheck.ok) {
    log.status = "rejected_hash";
    log.error = hashCheck.error;
    saveDb(db);
    return res.status(200).json({ ok: false, error: hashCheck.error });
  }

  if (!parsed.uid || !parsed.tx) {
    log.status = "rejected_missing_params";
    log.error = "Falta UID o TX.";
    saveDb(db);
    return res.status(200).json({ ok: false, error: "Falta UID o TX." });
  }

  const user = Object.values(db.users || {}).find(item =>
    String(item.id) === String(parsed.uid) ||
    String(item.username) === String(parsed.uid) ||
    String(item.email) === String(parsed.uid)
  );

  if (!user) {
    log.status = "rejected_user_not_found";
    log.error = "Usuario no encontrado.";
    saveDb(db);
    return res.status(200).json({ ok: false, error: "Usuario no encontrado." });
  }

  if (db.bitlabsTransactions[parsed.tx]) {
    log.status = "duplicate";
    log.userId = user.id;
    saveDb(db);
    return res.status(200).json({ ok: true, duplicate: true });
  }

  if (!isBitLabsRewardableType(parsed.type)) {
    log.status = "ignored_type";
    log.userId = user.id;
    saveDb(db);
    return res.status(200).json({ ok: true, ignored: true, type: parsed.type });
  }

  if (parsed.rewardCoins <= 0) {
    log.status = "ignored_zero_reward";
    log.userId = user.id;
    saveDb(db);
    return res.status(200).json({ ok: true, ignored: true, rewardCoins: 0 });
  }

  user.stats = user.stats || {};
  user.stats.bitlabsCompleted = (user.stats.bitlabsCompleted || 0) + 1;
  user.stats.bitlabsCoins = (user.stats.bitlabsCoins || 0) + parsed.rewardCoins;
  user.stats.coinsEarned = (user.stats.coinsEarned || 0) + parsed.rewardCoins;
  user.coins = (user.coins || 0) + parsed.rewardCoins;

  db.bitlabsTransactions[parsed.tx] = {
    userId: user.id,
    username: user.username,
    tx: parsed.tx,
    rewardCoins: parsed.rewardCoins,
    type: parsed.type,
    offerId: parsed.offerId,
    offerName: parsed.offerName,
    raw: parsed.raw,
    createdAt: new Date().toISOString()
  };

  log.status = "credited";
  log.userId = user.id;
  log.rewardCoins = parsed.rewardCoins;
  saveDb(db);

  return res.status(200).json({
    ok: true,
    credited: true,
    uid: user.id,
    tx: parsed.tx,
    rewardCoins: parsed.rewardCoins
  });
});

app.get("/api/direct-ad/config", authUser, (req, res) => {
  const daily = ensureDaily(req.user);
  const now = Date.now();

  const links = getDirectAdLinks().map(link => {
    const state = daily.directAds[link.id] || {
      startedAt: 0,
      lastRewardAt: 0
    };

    const cooldownMs = link.cooldownSeconds * 1000;
    const remainingCooldownMs = Math.max(0, (Number(state.lastRewardAt || 0) + cooldownMs) - now);

    return {
      id: link.id,
      name: link.name,
      description: link.description,
      rewardCoins: link.rewardCoins,
      waitSeconds: link.waitSeconds,
      cooldownSeconds: link.cooldownSeconds,
      remainingCooldownMs
    };
  });

  res.json({
    configured: links.length > 0,
    links,
    defaultRewardCoins: DIRECT_AD_REWARD_COINS,
    defaultWaitSeconds: DIRECT_AD_WAIT_SECONDS,
    defaultCooldownSeconds: DIRECT_AD_COOLDOWN_SECONDS
  });
});

app.post("/api/direct-ad/start", authUser, (req, res) => {
  const link = getDirectAdLink(req.body.linkId);

  if (!link) {
    return res.status(400).json({ error: "Direct Ad no configurado o enlace no válido." });
  }

  const daily = ensureDaily(req.user);
  daily.directAds[link.id] = daily.directAds[link.id] || {
    startedAt: 0,
    lastRewardAt: 0
  };

  const state = daily.directAds[link.id];
  const now = Date.now();
  const cooldownMs = link.cooldownSeconds * 1000;
  const remainingCooldownMs = Math.max(0, (Number(state.lastRewardAt || 0) + cooldownMs) - now);

  if (remainingCooldownMs > 0) {
    return res.status(429).json({
      error: `Debes esperar antes de abrir ${link.name}.`,
      linkId: link.id,
      remainingCooldownMs
    });
  }

  state.startedAt = now;
  saveDb(req.db);

  res.json({
    ok: true,
    linkId: link.id,
    name: link.name,
    url: link.url,
    startedAt: now,
    waitSeconds: link.waitSeconds,
    rewardCoins: link.rewardCoins
  });
});

app.post("/api/direct-ad/complete", authUser, (req, res) => {
  const link = getDirectAdLink(req.body.linkId);

  if (!link) {
    return res.status(400).json({ error: "Direct Ad no configurado o enlace no válido." });
  }

  const daily = ensureDaily(req.user);
  daily.directAds[link.id] = daily.directAds[link.id] || {
    startedAt: 0,
    lastRewardAt: 0
  };

  const state = daily.directAds[link.id];
  const now = Date.now();
  const waitMs = link.waitSeconds * 1000;
  const cooldownMs = link.cooldownSeconds * 1000;

  if (!state.startedAt) {
    return res.status(400).json({ error: `Primero debes abrir ${link.name}.` });
  }

  const remainingWaitMs = Math.max(0, (Number(state.startedAt || 0) + waitMs) - now);
  if (remainingWaitMs > 0) {
    return res.status(429).json({
      error: `Debes permanecer al menos ${link.waitSeconds} segundos antes de reclamar.`,
      linkId: link.id,
      remainingWaitMs
    });
  }

  const remainingCooldownMs = Math.max(0, (Number(state.lastRewardAt || 0) + cooldownMs) - now);
  if (remainingCooldownMs > 0) {
    return res.status(429).json({
      error: `Debes esperar antes de reclamar otra recompensa de ${link.name}.`,
      linkId: link.id,
      remainingCooldownMs
    });
  }

  state.startedAt = 0;
  state.lastRewardAt = now;

  req.user.stats.directAdsCompleted = (req.user.stats.directAdsCompleted || 0) + 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + link.rewardCoins;
  req.user.coins += link.rewardCoins;

  saveDb(req.db);

  res.json({
    ok: true,
    linkId: link.id,
    name: link.name,
    added: link.rewardCoins,
    coins: req.user.coins,
    nextAvailableAt: now + cooldownMs,
    cooldownSeconds: link.cooldownSeconds
  });
});

app.get("/api/surveys/offerwall", authUser, (req, res) => {
  if (!OFFERWALL_URL) {
    return res.json({
      configured: false,
      name: OFFERWALL_NAME,
      url: "",
      message: "Offerwall no configurado. Añade OFFERWALL_URL en variables de entorno."
    });
  }

  const replacements = {
    "{{USER_ID}}": encodeURIComponent(req.user.id),
    "{{USERNAME}}": encodeURIComponent(req.user.username),
    "{{EMAIL}}": encodeURIComponent(req.user.email),
    "{{PUBLIC_URL}}": encodeURIComponent(PUBLIC_URL || "")
  };

  let url = OFFERWALL_URL;
  for (const [key, value] of Object.entries(replacements)) {
    url = url.split(key).join(value);
  }

  res.json({
    configured: true,
    name: OFFERWALL_NAME,
    url,
    userId: req.user.id
  });
});

app.post("/api/puzzle/unity-ad", authUser, (req, res) => {
  const daily = ensureDaily(req.user);

  if (!consumeRewardedAds(daily, "puzzle")) {
    return res.status(429).json({
      error: `Necesitas ver ${REQUIRED_ADS_PER_REWARD} anuncios antes de desbloquear el siguiente puzzle.`,
      ...rewardedProgressPayload(daily, "puzzle")
    });
  }

  daily.puzzleUnityAdReady = true;

  saveDb(req.db);

  res.json({
    ok: true,
    puzzleUnityAdReady: true,
    message: "Unity Ad visto. Puedes desbloquear el siguiente puzzle."
  });
});

app.post("/api/puzzle/complete", authUser, (req, res) => {
  const puzzleId = String(req.body.puzzleId || "puzzle1").slice(0, 30);
  const allowedPuzzles = ["puzzle1", "puzzle2", "puzzle3"];

  if (!allowedPuzzles.includes(puzzleId)) {
    return res.status(400).json({ error: "Puzzle no válido." });
  }

  const daily = ensureDaily(req.user);
  const now = Date.now();
  const twoMinutes = 2 * 60 * 1000;
  const elapsed = now - Number(daily.puzzleCompletedAt || 0);

  if (daily.puzzleCompletedAt && elapsed < twoMinutes) {
    return res.status(429).json({
      error: "Debes esperar 2 minutos entre puzzles.",
      waitMs: twoMinutes - elapsed
    });
  }

  if (daily.puzzleCompletedAt && !daily.puzzleUnityAdReady) {
    return res.status(429).json({
      error: "Antes de pasar al siguiente puzzle debes ver un Unity Ad recompensado.",
      needsUnityAd: true
    });
  }

  const reward = 15;

  daily.puzzleCompletedAt = now;
  daily.puzzleUnityAdReady = false;

  req.user.stats.puzzlesCompleted = (req.user.stats.puzzlesCompleted || 0) + 1;
  req.user.stats.coinsEarned = (req.user.stats.coinsEarned || 0) + reward;
  req.user.coins += reward;

  saveDb(req.db);

  res.json({
    ok: true,
    puzzleId,
    added: reward,
    coins: req.user.coins,
    nextAvailableAt: now + twoMinutes,
    needsUnityAdForNext: true
  });
});

app.get("/api/admin/tasks", adminOnly, (req, res) => {
  const db = loadDb();
  res.json({ tasks: getOnlineTasks(db, true) });
});

app.post("/api/admin/tasks", adminOnly, (req, res) => {
  const db = loadDb();
  const tasks = ensureOnlineTasks(db);

  const title = String(req.body.title || "").trim().slice(0, 120);
  const description = String(req.body.description || "").trim().slice(0, 500);
  const instructions = String(req.body.instructions || "").trim().slice(0, 1000);
  const rewardCoins = Math.max(0, Math.floor(Number(req.body.rewardCoins || 0)));
  const estimatedTime = String(req.body.estimatedTime || "").trim().slice(0, 80);
  const category = String(req.body.category || "General").trim().slice(0, 80);
  const proofFileRequired = Boolean(req.body.proofFileRequired || false);
  const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive);

  if (title.length < 3) {
    return res.status(400).json({ error: "El título debe tener al menos 3 caracteres." });
  }

  if (rewardCoins <= 0) {
    return res.status(400).json({ error: "La recompensa debe ser mayor que 0 coins." });
  }

  let id = sanitizeTaskId(req.body.id || title);
  if (!id) id = `task-${Date.now()}`;

  if (tasks.some(task => task.id === id)) {
    id = `${id}-${Date.now()}`;
  }

  const task = {
    id,
    title,
    description,
    instructions,
    rewardCoins,
    estimatedTime,
    category,
    proofFileRequired,
    isActive,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.onlineTasks.push(task);
  saveDb(db);

  res.json({ ok: true, task });
});

app.post("/api/admin/tasks/:id", adminOnly, (req, res) => {
  const db = loadDb();
  const tasks = ensureOnlineTasks(db);
  const task = tasks.find(item => item.id === req.params.id);

  if (!task) {
    return res.status(404).json({ error: "Trabajo no encontrado." });
  }

  const fields = ["title", "description", "instructions", "estimatedTime", "category"];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      task[field] = String(req.body[field] || "").trim().slice(0, field === "instructions" ? 1000 : 500);
    }
  }

  if (req.body.rewardCoins !== undefined) {
    task.rewardCoins = Math.max(0, Math.floor(Number(req.body.rewardCoins || 0)));
  }

  if (req.body.proofFileRequired !== undefined) {
    task.proofFileRequired = Boolean(req.body.proofFileRequired);
  }

  if (req.body.isActive !== undefined) {
    task.isActive = Boolean(req.body.isActive);
  }

  task.updatedAt = new Date().toISOString();
  saveDb(db);

  res.json({ ok: true, task });
});

app.delete("/api/admin/tasks/:id", adminOnly, (req, res) => {
  const db = loadDb();
  db.onlineTasks = db.onlineTasks || [];

  const before = db.onlineTasks.length;
  db.onlineTasks = db.onlineTasks.filter(item => item.id !== req.params.id);

  if (db.onlineTasks.length === before) {
    return res.status(404).json({ error: "Trabajo no encontrado." });
  }

  saveDb(db);
  res.json({ ok: true });
});

app.get("/api/admin/task-submissions", adminOnly, (req, res) => {
  const db = loadDb();

  const submissions = (db.taskSubmissions || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ submissions });
});

app.post("/api/admin/task-submissions/:id/status", adminOnly, (req, res) => {
  const db = loadDb();
  db.taskSubmissions = db.taskSubmissions || [];
  db.onlineTasks = db.onlineTasks || [];

  const submission = db.taskSubmissions.find(item => item.id === req.params.id);

  if (!submission) {
    return res.status(404).json({ error: "Solicitud de tarea no encontrada." });
  }

  const status = String(req.body.status || "").trim();
  const allowed = ["pending_review", "approved", "rejected", "completed"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Estado no válido." });
  }

  const adminNote = String(req.body.adminNote || "").trim().slice(0, 500);
  const user = db.users[submission.userId];

  if ((status === "approved" || status === "completed") && !submission.credited) {
    if (user) {
      user.coins = (user.coins || 0) + submission.rewardCoins;
      user.stats = user.stats || {};
      user.stats.tasksApproved = (user.stats.tasksApproved || 0) + 1;
      user.stats.taskCoins = (user.stats.taskCoins || 0) + submission.rewardCoins;
      user.stats.coinsEarned = (user.stats.coinsEarned || 0) + submission.rewardCoins;
      submission.credited = true;
    }
  }

  submission.status = status;
  submission.adminNote = adminNote;
  submission.updatedAt = new Date().toISOString();

  saveDb(db);

  res.json({
    ok: true,
    submission
  });
});

app.get("/api/admin/stats", adminOnly, (req, res) => {
  const db = loadDb();
  const users = Object.values(db.users);
  const withdrawals = db.withdrawals;

  const pending = withdrawals.filter(w => w.status === "pending_review");
  const paid = withdrawals.filter(w => w.status === "paid");

  res.json({
    usersCount: users.length,
    totalCoins: users.reduce((sum, u) => sum + (u.coins || 0), 0),
    withdrawalsCount: withdrawals.length,
    pendingWithdrawals: pending.length,
    paidWithdrawals: paid.length,
    pendingCoins: pending.reduce((sum, w) => sum + w.coins, 0),
    paidCoins: paid.reduce((sum, w) => sum + w.coins, 0)
  });
});

app.get("/api/admin/users", adminOnly, (req, res) => {
  const db = loadDb();
  const users = Object.values(db.users).map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    coins: u.coins,
    createdAt: u.createdAt,
    stats: u.stats
  }));

  res.json({ users });
});

app.get("/api/admin/withdrawals", adminOnly, (req, res) => {
  const db = loadDb();
  const status = String(req.query.status || "").trim();

  let withdrawals = db.withdrawals;
  if (status) withdrawals = withdrawals.filter(w => w.status === status);

  withdrawals = withdrawals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({ withdrawals });
});

app.patch("/api/admin/withdrawals/:id", adminOnly, (req, res) => {
  const db = loadDb();
  const withdrawal = db.withdrawals.find(w => w.id === req.params.id);

  if (!withdrawal) {
    return res.status(404).json({ error: "Solicitud no encontrada." });
  }

  const allowed = ["pending_review", "approved", "rejected", "paid"];
  const status = String(req.body.status || "").trim();

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Estado no válido." });
  }

  withdrawal.status = status;
  withdrawal.adminNote = String(req.body.adminNote || withdrawal.adminNote || "").slice(0, 240);
  withdrawal.updatedAt = new Date().toISOString();

  saveDb(db);

  res.json({ ok: true, withdrawal });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`${APP_NAME} funcionando en http://localhost:${PORT}`);
  console.log(`Dashboard admin: http://localhost:${PORT}/admin`);
  console.log(`Entorno: ${NODE_ENV}`);
  console.log(`DB_FILE: ${DB_FILE}`);
  if (!IS_PRODUCTION) {
    console.log(`ADMIN_KEY dev: ${ADMIN_KEY}`);
  }
});
