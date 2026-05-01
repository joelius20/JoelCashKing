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
const PUBLIC_URL = process.env.PUBLIC_URL || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: IS_PRODUCTION ? "1h" : 0
}));

function initialDb() {
  return {
    users: {},
    withdrawals: [],
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
    wordSearch: 0
  };
  user.daily[key].ads = user.daily[key].ads || 0;
  user.daily[key].spins = user.daily[key].spins || 0;
  user.daily[key].rouletteUnityAds = user.daily[key].rouletteUnityAds || 0;
  user.daily[key].extraSpins = user.daily[key].extraSpins || 0;
  user.daily[key].quiz = user.daily[key].quiz || 0;
  user.daily[key].wordSearch = user.daily[key].wordSearch || 0;
  return user.daily[key];
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
      withdrawalsRequested: 0
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

app.post("/api/reward/ad", authUser, (req, res) => {
  const daily = ensureDaily(req.user);

  if (daily.ads >= 20) {
    return res.status(429).json({ error: "Límite diario de anuncios alcanzado. Vuelve mañana." });
  }

  daily.ads += 1;
  req.user.stats.adsWatched += 1;
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
  const reward = 30;

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
      error: "Has alcanzado el límite de anuncios extra para la ruleta por hoy."
    });
  }

  daily.rouletteUnityAds += 1;
  req.user.stats.unityAdsWatched = (req.user.stats.unityAdsWatched || 0) + 1;

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
