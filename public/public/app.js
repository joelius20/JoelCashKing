let token = localStorage.getItem("jck_token") || "";
let rouletteRotation = 0;
let currentUserData = null;

const $ = (id) => document.getElementById(id);

const REWARDED_VIGNETTE_ZONE = "10950905";
const REWARDED_VIGNETTE_SRC = "https://n6wxm.com/vignette.min.js";
const REWARDED_AD_SECONDS = 15;
const REQUIRED_ADS_PER_REWARD = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeRewardedOverlay() {
  const old = document.getElementById("rewardedAdOverlay");
  if (old) old.remove();
}

function showRewardedOverlay(message = "Cargando anuncio recompensado...", currentAd = 1, totalAds = REQUIRED_ADS_PER_REWARD) {
  removeRewardedOverlay();

  const overlay = document.createElement("div");
  overlay.id = "rewardedAdOverlay";
  overlay.className = "rewarded-ad-overlay";
  overlay.innerHTML = `
    <div class="rewarded-ad-card">
      <div class="rewarded-ad-icon">📺</div>
      <h2>Anuncio recompensado</h2>
      <p id="rewardedAdText">${message}</p>
      <div class="rewarded-ad-progress">
        <span>Anuncio ${currentAd} de ${totalAds}</span>
        <div><i style="width:${Math.round((currentAd / totalAds) * 100)}%"></i></div>
      </div>
      <strong id="rewardedAdCountdown">${REWARDED_AD_SECONDS}s</strong>
      <small>No cierres esta pantalla hasta que termine el contador.</small>
    </div>
  `;

  document.body.appendChild(overlay);
}

function injectVignetteAdScript() {
  const script = document.createElement("script");
  script.dataset.zone = REWARDED_VIGNETTE_ZONE;
  script.src = `${REWARDED_VIGNETTE_SRC}?t=${Date.now()}`;
  script.async = true;
  document.body.appendChild(script);

  setTimeout(() => {
    try {
      script.remove();
    } catch {}
  }, 60000);
}

let ayetConfigCache = null;
let ayetInitializedUser = null;

function isAyetAvailable() {
  return typeof window.AyetVideoSdk !== "undefined";
}

async function getAyetConfig() {
  if (ayetConfigCache) return ayetConfigCache;
  ayetConfigCache = await api("/api/ayet/config");
  return ayetConfigCache;
}

async function initAyetRewardedVideo() {
  const config = await getAyetConfig();

  if (!config.configured) {
    throw new Error("ayeT-Studios no está configurado todavía. Añade AYET_PLACEMENT_ID y AYET_ADSLOT_NAME en Railway.");
  }

  if (!isAyetAvailable()) {
    throw new Error("No se ha cargado el SDK de ayeT-Studios. Revisa bloqueadores de anuncios o la conexión.");
  }

  if (ayetInitializedUser === config.externalIdentifier) {
    return config;
  }

  await AyetVideoSdk.init(
    Number(config.placementId),
    String(config.externalIdentifier),
    config.optionalParameter || null
  );

  ayetInitializedUser = config.externalIdentifier;
  return config;
}

function requestAyetAd(adslotName) {
  return new Promise((resolve, reject) => {
    AyetVideoSdk.requestAd(
      adslotName,
      () => resolve(true),
      (msg) => reject(new Error(`ayeT no pudo cargar vídeo: ${msg}`))
    );
  });
}

function playAyetFullsizeAd() {
  return new Promise((resolve, reject) => {
    let settled = false;

    AyetVideoSdk.callbackError = function(e) {
      if (!settled) {
        settled = true;
        reject(new Error(`Error de vídeo ayeT: ${JSON.stringify(e)}`));
      }
    };

    AyetVideoSdk.callbackRewarded = function(details) {
      if (!settled) {
        settled = true;
        resolve(details);
      }
    };

    AyetVideoSdk.playFullsizeAd();

    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("El vídeo tardó demasiado en recompensar. Prueba de nuevo."));
      }
    }, 120000);
  });
}

async function getRewardedAdStatus(purpose) {
  const params = new URLSearchParams({ purpose });
  return api(`/api/rewarded-ad/status?${params.toString()}`);
}

async function waitForS2SProgress(purpose, previousProgress) {
  const startedAt = Date.now();
  const timeoutMs = 75000;

  while (Date.now() - startedAt < timeoutMs) {
    const status = await getRewardedAdStatus(purpose);

    if (status.progress > previousProgress || status.ready) {
      return status;
    }

    const text = document.getElementById("rewardedAdText");
    if (text) {
      const remaining = Math.max(0, Math.ceil((timeoutMs - (Date.now() - startedAt)) / 1000));
      text.textContent = `Vídeo completado. Esperando callback S2S de ayeT... ${remaining}s`;
    }

    await sleep(3000);
  }

  throw new Error("El vídeo terminó, pero el callback S2S de ayeT no llegó a tiempo. Puede tardar hasta 60 segundos; prueba otra vez en unos segundos.");
}

async function showAyetRewardedVideo(message = "Mira el vídeo para recibir tu recompensa.", purpose = "coins") {
  const config = await initAyetRewardedVideo();

  if (typeof AyetVideoSdk.setCustomParameter === "function") {
    AyetVideoSdk.setCustomParameter("custom_1", purpose);
    AyetVideoSdk.setCustomParameter("custom_2", "joelcashking");
  }

  const beforeStatus = await getRewardedAdStatus(purpose);

  showRewardedOverlay(message, 1, REQUIRED_ADS_PER_REWARD);
  const text = document.getElementById("rewardedAdText");
  if (text) text.textContent = "Preparando vídeo recompensado de ayeT-Studios...";

  await requestAyetAd(config.adslotName);

  if (text) text.textContent = "Reproduce el vídeo hasta el final para que cuente.";
  removeRewardedOverlay();

  const details = await playAyetFullsizeAd();

  if (config.rewardMode === "s2s") {
    showRewardedOverlay("Vídeo completado. Validando por S2S...", 1, REQUIRED_ADS_PER_REWARD);
    const status = await waitForS2SProgress(purpose, beforeStatus.progress || 0);
    removeRewardedOverlay();
    return status;
  }

  const progress = await api("/api/rewarded-ad/ayet-reward", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      details
    })
  });

  return progress;
}

async function showRewardedVignetteAd(message = "Se abrirán anuncios. La recompensa se aplica al completar todos.", purpose = "coins") {
  try {
    const config = await getAyetConfig();

    if (config.configured) {
      let lastProgress = null;

      for (let adNumber = 1; adNumber <= REQUIRED_ADS_PER_REWARD; adNumber++) {
        showRewardedOverlay(
          `${message} Vídeo ${adNumber} de ${REQUIRED_ADS_PER_REWARD}.`,
          adNumber,
          REQUIRED_ADS_PER_REWARD
        );

        lastProgress = await showAyetRewardedVideo(
          `${message} Vídeo ${adNumber} de ${REQUIRED_ADS_PER_REWARD}.`,
          purpose
        );

        if (adNumber < REQUIRED_ADS_PER_REWARD) {
          showRewardedOverlay("Vídeo validado en servidor. Preparando el siguiente...", adNumber, REQUIRED_ADS_PER_REWARD);
          const textNext = document.getElementById("rewardedAdText");
          if (textNext) {
            textNext.textContent = `Progreso validado: ${lastProgress.progress}/${lastProgress.required}.`;
          }
          await sleep(1200);
          removeRewardedOverlay();
        }
      }

      removeRewardedOverlay();

      if (!lastProgress || !lastProgress.ready) {
        throw new Error("No se pudo validar el mínimo de vídeos recompensados.");
      }

      return true;
    }
  } catch (err) {
    console.warn("Fallo ayeT, usando Vignette fallback:", err.message);
  }

  // Fallback: Vignette antiguo. Solo para pruebas si ayeT no está configurado o no hay fill.
  let lastProgress = null;

  for (let adNumber = 1; adNumber <= REQUIRED_ADS_PER_REWARD; adNumber++) {
    showRewardedOverlay(message, adNumber, REQUIRED_ADS_PER_REWARD);
    injectVignetteAdScript();

    const text = document.getElementById("rewardedAdText");
    if (text) {
      text.textContent = `${message} Debes completar ${REQUIRED_ADS_PER_REWARD} anuncios para recibir la recompensa.`;
    }

    for (let i = REWARDED_AD_SECONDS; i >= 0; i--) {
      const counter = document.getElementById("rewardedAdCountdown");
      if (counter) counter.textContent = `${i}s`;
      await sleep(1000);
    }

    lastProgress = await api("/api/rewarded-ad/progress", {
      method: "POST",
      body: JSON.stringify({ purpose })
    });

    if (adNumber < REQUIRED_ADS_PER_REWARD) {
      const textNext = document.getElementById("rewardedAdText");
      if (textNext) {
        textNext.textContent = `Anuncio registrado en servidor. Progreso: ${lastProgress.progress}/${lastProgress.required}. Preparando el siguiente anuncio...`;
      }
      await sleep(900);
    }
  }

  removeRewardedOverlay();

  if (!lastProgress || !lastProgress.ready) {
    throw new Error("No se pudo validar el mínimo de anuncios en el servidor.");
  }

  return true;
}


const quizPacks = [
  {
    title: "Quiz 1: JoelCashKing básico",
    questions: [
      {
        q: "¿Qué minijuego consiste en encontrar palabras ocultas?",
        options: ["Sopa de letras", "Carreras", "Ajedrez"],
        answer: 0
      },
      {
        q: "¿Qué se gana en JoelCashKing?",
        options: ["Monedas internas", "Bitcoin directo", "Entradas de casino"],
        answer: 0
      },
      {
        q: "¿Qué método de retirada tiene la tienda de este MVP?",
        options: ["PayPal", "Tarjeta regalo aleatoria", "Criptomonedas sin revisar"],
        answer: 0
      },
      {
        q: "¿Qué pasa con una retirada antes de pagarla?",
        options: ["Queda pendiente de revisión", "Se paga sin revisar", "Se borra la cuenta"],
        answer: 0
      }
    ]
  },
  {
    title: "Quiz 2: Minijuegos y recompensas",
    questions: [
      {
        q: "¿Cuántas tiradas gratis tiene la ruleta al día?",
        options: ["1 tirada", "5 tiradas", "Ilimitadas"],
        answer: 0
      },
      {
        q: "¿Qué se necesita para una tirada extra de ruleta?",
        options: ["Ver 2 anuncios recompensados", "Pagar con tarjeta", "Borrar la cuenta"],
        answer: 0
      },
      {
        q: "¿Qué recompensa tiene la Sopa 3?",
        options: ["10 coins", "30 coins", "100 coins"],
        answer: 0
      },
      {
        q: "¿Dónde se ven los retiros del usuario?",
        options: ["En el historial de retiros", "Solo en la consola", "No se pueden ver"],
        answer: 0
      }
    ]
  },
  {
    title: "Quiz 3: Tienda de retiros",
    questions: [
      {
        q: "¿Cuál de estos métodos está disponible en la tienda?",
        options: ["Bizum", "Cheque secreto", "Pago automático sin revisión"],
        answer: 0
      },
      {
        q: "¿Qué estado aparece antes de revisar una solicitud?",
        options: ["Pendiente", "Completado", "Invisible"],
        answer: 0
      },
      {
        q: "¿Qué tarjeta regalo está disponible?",
        options: ["Steam", "Gasolina infinita", "Billete de avión automático"],
        answer: 0
      },
      {
        q: "¿Quién marca una solicitud como completada?",
        options: ["El admin", "El navegador solo", "El usuario sin revisión"],
        answer: 0
      }
    ]
  }
];

let currentQuizPackIndex = Number(localStorage.getItem("jck_current_quiz_pack") || 0);
if (!Number.isFinite(currentQuizPackIndex) || currentQuizPackIndex < 0 || currentQuizPackIndex >= quizPacks.length) {
  currentQuizPackIndex = 0;
}

function getCurrentQuizPack() {
  return quizPacks[currentQuizPackIndex] || quizPacks[0];
}

function goToNextQuizPack() {
  currentQuizPackIndex = (currentQuizPackIndex + 1) % quizPacks.length;
  localStorage.setItem("jck_current_quiz_pack", String(currentQuizPackIndex));
  renderQuiz();
}

const wordPuzzles = {
  basic: {
    title: "Sopa 1",
    intro: "Primera sopa: más palabras y más dificultad. Cuando la termines, puedes pasar a la segunda.",
    words: ["CASH", "KING", "RETO", "DINERO", "MONEDAS", "LOGIN", "QUIZ", "PREMIO", "TIENDA"],
    grid: [
      ["C","A","S","H","R","T","Q","L","M","N","O","P"],
      ["Z","M","O","N","E","D","A","S","I","R","A","T"],
      ["K","I","N","G","X","Y","Z","O","E","A","B","C"],
      ["P","R","E","M","I","O","H","G","N","S","D","E"],
      ["D","I","N","E","R","O","J","K","D","O","F","G"],
      ["L","O","G","I","N","A","B","C","A","P","H","I"],
      ["Q","U","I","Z","D","E","F","G","K","A","J","K"],
      ["T","I","E","N","D","A","L","M","N","S","L","M"],
      ["R","E","T","O","N","O","P","Q","R","T","N","O"],
      ["A","B","C","D","E","F","G","H","I","A","P","Q"],
      ["J","K","L","M","N","O","P","Q","R","S","R","S"],
      ["T","U","V","W","X","Y","Z","A","B","C","T","U"]
    ]
  },
  advanced: {
    title: "Sopa 2 difícil",
    intro: "Segunda sopa: más larga, más mezclada y con palabras del sistema de recompensas.",
    words: ["RECOMPENSA", "ANUNCIO", "USUARIO", "EFECTIVO", "PAYPAL", "ESPAÑA", "RULETA", "RETIRADA", "DASHBOARD", "FRAUDE", "ADMIN"],
    grid: [
      ["R","E","C","O","M","P","E","N","S","A","L","M"],
      ["A","N","U","N","C","I","O","P","Q","R","S","T"],
      ["U","S","U","A","R","I","O","A","B","C","D","E"],
      ["E","F","E","C","T","I","V","O","F","G","H","I"],
      ["P","A","Y","P","A","L","J","K","L","M","N","O"],
      ["E","S","P","A","Ñ","A","P","Q","R","S","T","U"],
      ["R","U","L","E","T","A","V","W","X","Y","Z","A"],
      ["R","E","T","I","R","A","D","A","B","C","D","E"],
      ["D","A","S","H","B","O","A","R","D","F","G","H"],
      ["F","R","A","U","D","E","I","J","K","L","M","N"],
      ["A","D","M","I","N","O","P","Q","R","S","T","U"],
      ["V","W","X","Y","Z","A","B","C","D","E","F","G"]
    ]
  },
  easy3: {
    title: "Sopa 3 fácil",
    intro: "Tercera sopa: más sencilla y rápida. Recompensa especial: 10 coins.",
    reward: 10,
    words: ["JOEL", "COINS", "APP", "RETO", "JUEGO", "KING"],
    grid: [
      ["J","O","E","L","A","B","C","D"],
      ["C","O","I","N","S","E","F","G"],
      ["A","P","P","H","I","J","K","L"],
      ["R","E","T","O","M","N","O","P"],
      ["J","U","E","G","O","Q","R","S"],
      ["K","I","N","G","T","U","V","W"],
      ["X","Y","Z","A","B","C","D","E"],
      ["F","G","H","I","J","K","L","M"]
    ]
  }
};

let currentPuzzleId = localStorage.getItem("jck_current_puzzle") || "basic";

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error inesperado.");
  return data;
}

function setAuthMode(mode) {
  const register = mode === "register";

  $("registerForm").classList.toggle("hidden", !register);
  $("loginForm").classList.toggle("hidden", register);
  $("showRegister").classList.toggle("active", register);
  $("showLogin").classList.toggle("active", !register);
  $("authMsg").textContent = "";
}

function renderPrivate(user) {
  currentUserData = user;

  $("publicArea").classList.add("hidden");
  $("privateArea").classList.remove("hidden");

  const totalAds = (user.stats.adsWatched || 0) + (user.stats.unityAdsWatched || 0);
  const coinsEarned = user.stats.coinsEarned ?? user.coins ?? 0;

  $("currentUser").textContent = user.username;
  $("currentEmail").textContent = user.email;
  $("coinBalance").textContent = user.coins;
  $("minWithdrawal").textContent = `${user.minWithdrawalCoins} 🪙`;
  $("coinRate").textContent = `${user.coinRate} = 1€`;

  $("statQuiz").textContent = user.stats.quizSolved || 0;
  $("statWordSearch").textContent = user.stats.wordSearchSolved || 0;
  $("statSpins").textContent = user.stats.spins || 0;
  $("statAds").textContent = totalAds;
  if ($("statPuzzles")) $("statPuzzles").textContent = user.stats.puzzlesCompleted || 0;

  if ($("profileUsername")) $("profileUsername").textContent = user.username;
  if ($("profileEmail")) $("profileEmail").textContent = user.email;
  if ($("profileCoins")) $("profileCoins").textContent = `${user.coins} 🪙`;
  if ($("profileCoinsEarned")) $("profileCoinsEarned").textContent = `${coinsEarned} 🪙`;
  if ($("profileCreatedAt")) $("profileCreatedAt").textContent = new Date(user.createdAt).toLocaleDateString();
  if ($("profileAds")) $("profileAds").textContent = totalAds;
  if ($("profileQuiz")) $("profileQuiz").textContent = user.stats.quizSolved || 0;
  if ($("profileWordSearch")) $("profileWordSearch").textContent = user.stats.wordSearchSolved || 0;
  if ($("profileSpins")) $("profileSpins").textContent = user.stats.spins || 0;

  updateShopBalance();
}

function renderPublic() {
  $("privateArea").classList.add("hidden");
  $("publicArea").classList.remove("hidden");
}

async function refreshMe() {
  if (!token) {
    renderPublic();
    return;
  }

  try {
    const me = await api("/api/me");
    renderPrivate(me);
    await loadMyWithdrawals();
  } catch {
    token = "";
    localStorage.removeItem("jck_token");
    renderPublic();
  }
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active-screen"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  $(screenId).classList.add("active-screen");
  document.querySelector(`[data-screen="${screenId}"]`).classList.add("active");

  if (screenId === "shop" || screenId === "profile") loadMyWithdrawals();
  if (screenId === "puzzle") renderPuzzle();
  if (screenId === "surveys") resetOfferwallMessage();
}

function renderQuiz() {
  const pack = getCurrentQuizPack();
  if ($("quizTitle")) $("quizTitle").textContent = pack.title;

  $("quizContainer").innerHTML = pack.questions.map((item, index) => `
    <div class="question">
      <strong>${index + 1}. ${item.q}</strong>
      ${item.options.map((opt, optIndex) => `
        <label>
          <input type="radio" name="q${index}" value="${optIndex}">
          ${opt}
        </label>
      `).join("")}
    </div>
  `).join("");
}

function renderWordGrid() {
  const puzzle = wordPuzzles[currentPuzzleId] || wordPuzzles.basic;
  const grid = $("wordGrid");

  if ($("wordSearchIntro")) $("wordSearchIntro").textContent = puzzle.intro;
  if ($("wordList")) $("wordList").innerHTML = `<strong>Palabras:</strong> ${puzzle.words.join(" · ")}`;

  $("wordPuzzle1Btn")?.classList.toggle("active", currentPuzzleId === "basic");
  $("wordPuzzle2Btn")?.classList.toggle("active", currentPuzzleId === "advanced");
  $("wordPuzzle3Btn")?.classList.toggle("active", currentPuzzleId === "easy3");

  if ($("finishWordSearchBtn")) {
    const reward = puzzle.reward || (currentPuzzleId === "easy3" ? 10 : 30);
    $("finishWordSearchBtn").textContent = `Completar ${puzzle.title} +${reward} 🪙`;
  }

  grid.innerHTML = "";

  puzzle.grid.flat().forEach(letter => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.textContent = letter;
    cell.type = "button";
    cell.addEventListener("click", () => cell.classList.toggle("selected"));
    grid.appendChild(cell);
  });
}

function statusLabel(status) {
  const map = {
    pending_review: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    paid: "Completado"
  };
  return map[status] || status;
}

function statusClass(status) {
  if (status === "paid") return "paid";
  if (status === "rejected") return "rejected";
  if (status === "approved") return "approved";
  return "pending";
}

function withdrawalMethodDetails(w) {
  const details = [];

  details.push(`<span>Método: ${w.method}</span>`);

  if (w.paypalEmail) details.push(`<span>PayPal: ${w.paypalEmail}</span>`);
  if (w.bizumName) details.push(`<span>Titular Bizum: ${w.bizumName}</span>`);
  if (w.bizumPhone) details.push(`<span>Teléfono Bizum: ${w.bizumPhone}</span>`);
  if (w.country) details.push(`<span>País: ${w.country}</span>`);
  if (w.cashCity) details.push(`<span>Ciudad/zona: ${w.cashCity}</span>`);
  if (w.cashContact) details.push(`<span>Contacto: ${w.cashContact}</span>`);
  if (w.cashNotes) details.push(`<span>Notas: ${w.cashNotes}</span>`);

  details.push(`<span>Fecha: ${new Date(w.createdAt).toLocaleString()}</span>`);
  if (w.updatedAt && w.updatedAt !== w.createdAt) {
    details.push(`<span>Última actualización: ${new Date(w.updatedAt).toLocaleString()}</span>`);
  }

  if (w.adminNote) details.push(`<span>Nota admin: ${w.adminNote}</span>`);

  return details.join("");
}

function renderWithdrawalHistory(containerId, withdrawals) {
  const box = $(containerId);
  if (!box) return;

  if (!withdrawals || !withdrawals.length) {
    box.innerHTML = `<div class="withdrawal-empty">Todavía no tienes solicitudes de retiro.</div>`;
    return;
  }

  box.innerHTML = withdrawals.map(w => `
    <div class="withdrawal-item">
      <div class="withdrawal-title-row">
        <strong>${w.coins} 🪙 · ${Number(w.estimatedEuro || 0).toFixed(2)} ${w.currency || "EUR"}</strong>
        <span class="status-pill ${statusClass(w.status)}">${statusLabel(w.status)}</span>
      </div>
      <div class="withdrawal-meta">
        ${withdrawalMethodDetails(w)}
      </div>
    </div>
  `).join("");
}

async function loadMyWithdrawals() {
  if (!token) return;

  try {
    const data = await api("/api/my-withdrawals");
    renderWithdrawalHistory("myWithdrawals", data.withdrawals);
    renderWithdrawalHistory("profileWithdrawals", data.withdrawals);
  } catch (err) {
    if ($("myWithdrawals")) $("myWithdrawals").innerHTML = `<p class="muted">${err.message}</p>`;
    if ($("profileWithdrawals")) $("profileWithdrawals").innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

function requireLogin() {
  if (!token) {
    alert("Primero debes registrarte o iniciar sesión.");
    return false;
  }
  return true;
}

$("showRegister").addEventListener("click", () => setAuthMode("register"));
$("showLogin").addEventListener("click", () => setAuthMode("login"));

$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    $("authMsg").textContent = "Creando cuenta...";
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: $("regUsername").value,
        email: $("regEmail").value,
        password: $("regPassword").value
      })
    });

    token = data.token;
    localStorage.setItem("jck_token", token);
    renderPrivate(data.user);
    $("authMsg").textContent = "";
  } catch (err) {
    $("authMsg").textContent = err.message;
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    $("authMsg").textContent = "Entrando...";
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: $("loginIdentifier").value,
        password: $("loginPassword").value
      })
    });

    token = data.token;
    localStorage.setItem("jck_token", token);
    renderPrivate(data.user);
    $("authMsg").textContent = "";
    await loadMyWithdrawals();
  } catch (err) {
    $("authMsg").textContent = err.message;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    if (token) await api("/api/logout", { method: "POST" });
  } catch {}

  token = "";
  localStorage.removeItem("jck_token");
  renderPublic();
  setAuthMode("login");
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.screen));
});

$("watchAdBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("watchAdBtn").disabled = true;
    $("adMsg").textContent = "Cargando 5 anuncios recompensados...";
    await showRewardedVignetteAd("Mira 5 anuncios para recibir tus coins.", "coins");

    const data = await api("/api/reward/ad", { method: "POST" });
    $("coinBalance").textContent = data.coins;
    $("adMsg").textContent = `Has ganado ${data.added} monedas. Anuncios restantes hoy: ${data.adsLeftToday}.`;
    await refreshMe();
  } catch (err) {
    $("adMsg").textContent = err.message;
  } finally {
    $("watchAdBtn").disabled = false;
  }
});

$("submitQuizBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  const pack = getCurrentQuizPack();
  let correct = 0;

  pack.questions.forEach((item, index) => {
    const checked = document.querySelector(`input[name="q${index}"]:checked`);
    if (checked && Number(checked.value) === item.answer) correct++;
  });

  try {
    const data = await api("/api/reward/quiz", {
      method: "POST",
      body: JSON.stringify({
        quizPack: pack.title,
        correct,
        total: pack.questions.length
      })
    });

    $("coinBalance").textContent = data.coins;

    const completedTitle = pack.title;
    goToNextQuizPack();
    const nextTitle = getCurrentQuizPack().title;

    if ($("quizMsg")) {
      $("quizMsg").textContent = `${completedTitle} completado: ${correct}/${pack.questions.length} correctas. Ganaste ${data.added} monedas. Se ha cargado ${nextTitle}.`;
    } else {
      alert(`Correctas: ${correct}/${pack.questions.length}. Ganaste ${data.added} monedas.`);
    }

    await refreshMe();
  } catch (err) {
    if ($("quizMsg")) $("quizMsg").textContent = err.message;
    else alert(err.message);
  }
});

$("wordPuzzle1Btn").addEventListener("click", () => {
  currentPuzzleId = "basic";
  localStorage.setItem("jck_current_puzzle", currentPuzzleId);
  renderWordGrid();
  $("wordSearchMsg").textContent = "";
});

$("wordPuzzle2Btn").addEventListener("click", () => {
  currentPuzzleId = "advanced";
  localStorage.setItem("jck_current_puzzle", currentPuzzleId);
  renderWordGrid();
  $("wordSearchMsg").textContent = "";
});

$("wordPuzzle3Btn").addEventListener("click", () => {
  currentPuzzleId = "easy3";
  localStorage.setItem("jck_current_puzzle", currentPuzzleId);
  renderWordGrid();
  $("wordSearchMsg").textContent = "";
});

$("finishWordSearchBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    const data = await api("/api/reward/wordsearch", {
      method: "POST",
      body: JSON.stringify({ puzzleId: currentPuzzleId })
    });

    $("coinBalance").textContent = data.coins;
    $("wordSearchMsg").textContent = `${wordPuzzles[currentPuzzleId].title} completada. Ganaste ${data.added} monedas.`;

    if (currentPuzzleId === "basic") {
      currentPuzzleId = "advanced";
      localStorage.setItem("jck_current_puzzle", currentPuzzleId);
      renderWordGrid();
      $("wordSearchMsg").textContent += " Se ha cargado la segunda sopa, más difícil.";
    } else if (currentPuzzleId === "advanced") {
      currentPuzzleId = "easy3";
      localStorage.setItem("jck_current_puzzle", currentPuzzleId);
      renderWordGrid();
      $("wordSearchMsg").textContent += " Se ha cargado la tercera sopa, más fácil y de 10 coins.";
    }

    await refreshMe();
  } catch (err) {
    $("wordSearchMsg").textContent = err.message;
  }
});

function updateUnityAdUi(data = {}) {
  const freeLeft = Number(data.freeSpinsLeft ?? 1);
  const progress = Number(data.unityAdsProgress ?? 0);

  if (freeLeft <= 0) {
    $("unityAdBtn").classList.remove("hidden");
    $("unityAdMsg").textContent = `anuncios recompensados para próxima tirada extra: ${progress}/2.`;
  } else {
    $("unityAdBtn").classList.add("hidden");
    $("unityAdMsg").textContent = "";
  }
}

$("spinBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    const data = await api("/api/roulette/spin", { method: "POST" });
    rouletteRotation += 720 + Math.floor(Math.random() * 360);

    $("rouletteWheel").style.transform = `rotate(${rouletteRotation}deg)`;
    $("coinBalance").textContent = data.coins;

    if (data.spinType === "unity_ads_extra") {
      $("rouletteResult").textContent = `Tirada extra con anuncios recompensados. Premio: ${data.prize} 🪙.`;
    } else {
      $("rouletteResult").textContent = `Premio: ${data.prize} 🪙. Tiradas gratis restantes hoy: ${data.freeSpinsLeft}.`;
    }

    updateUnityAdUi(data);
    await refreshMe();
  } catch (err) {
    $("rouletteResult").textContent = err.message;

    if (err.message.includes("anuncios recompensados") || err.message.includes("tirada extra")) {
      $("unityAdBtn").classList.remove("hidden");
      $("unityAdMsg").textContent = "Necesitas ver 2 anuncios de anuncios recompensados para desbloquear una tirada extra.";
    }
  }
});

$("unityAdBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("unityAdBtn").disabled = true;
    $("unityAdMsg").textContent = "Cargando 5 anuncios recompensados...";
    await showRewardedVignetteAd("Mira 5 anuncios para avanzar hacia una tirada extra.", "roulette");

    const data = await api("/api/roulette/unity-ad", { method: "POST" });
    $("unityAdMsg").textContent = `Bloque de 5 anuncios validado. Progreso para tirada extra: ${data.rouletteUnityAds}/2.`;

    if (data.rouletteUnityAds >= 2) {
      $("unityAdMsg").textContent = "Ya tienes 2 anuncios vistos. Puedes girar una tirada extra.";
    }

    await refreshMe();
  } catch (err) {
    $("unityAdMsg").textContent = err.message;
  } finally {
    $("unityAdBtn").disabled = false;
  }
});

const giftCardProviders = {
  amazon: {
    title: "Tarjeta regalo Amazon",
    subtitle: "Código o tarjeta digital para Amazon",
    button: "Solicitar tarjeta regalo Amazon"
  },
  googleplay: {
    title: "Tarjeta regalo Google Play",
    subtitle: "Código para apps, juegos y contenido digital",
    button: "Solicitar tarjeta regalo Google Play"
  },
  steam: {
    title: "Tarjeta regalo Steam",
    subtitle: "Código para juegos y saldo de Steam",
    button: "Solicitar tarjeta regalo Steam"
  },
  apple: {
    title: "Tarjeta regalo Apple",
    subtitle: "Código para Apple, App Store y servicios compatibles",
    button: "Solicitar tarjeta regalo Apple"
  },
  spotify: {
    title: "Tarjeta regalo Spotify",
    subtitle: "Código para música y entretenimiento",
    button: "Solicitar tarjeta regalo Spotify"
  }
};

function estimateEurosFromCoins(coins) {
  const rate = Number(currentUserData?.coinRate || 1000);
  return Number((Number(coins || 0) / rate).toFixed(2));
}

function formatEuro(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} €`;
}

function updateShopBalance() {
  if (!currentUserData) return;

  if ($("shopCoinBalance")) $("shopCoinBalance").textContent = `${currentUserData.coins} 🪙`;
  if ($("shopEuroEstimate")) $("shopEuroEstimate").textContent = `≈ ${formatEuro(estimateEurosFromCoins(currentUserData.coins))}`;

  updateAmountPreviews();
}

function updateAmountPreviews() {
  const paypalCoins = $("withdrawCoinsPaypal") ? $("withdrawCoinsPaypal").value : 0;
  const bizumCoins = $("withdrawCoinsBizum") ? $("withdrawCoinsBizum").value : 0;
  const cashCoins = $("withdrawCoinsCash") ? $("withdrawCoinsCash").value : 0;
  const giftCoins = $("withdrawCoinsGiftCard") ? $("withdrawCoinsGiftCard").value : 0;

  if ($("paypalPreview")) $("paypalPreview").textContent = formatEuro(estimateEurosFromCoins(paypalCoins));
  if ($("bizumPreview")) $("bizumPreview").textContent = formatEuro(estimateEurosFromCoins(bizumCoins));
  if ($("cashPreview")) $("cashPreview").textContent = formatEuro(estimateEurosFromCoins(cashCoins));
  if ($("giftCardPreview")) $("giftCardPreview").textContent = formatEuro(estimateEurosFromCoins(giftCoins));
}

function clearStoreActiveState() {
  [
    "storeCardPaypal",
    "storeCardBizum",
    "storeCardCash",
    "storeCardAmazon",
    "storeCardGooglePlay",
    "storeCardSteam",
    "storeCardApple",
    "storeCardSpotify"
  ].forEach(id => {
    if ($(id)) $(id).classList.remove("active");
  });
}

function showOnlyShopForm(formId) {
  ["paypalForm", "bizumForm", "cashForm", "giftCardForm"].forEach(id => {
    if ($(id)) $(id).classList.toggle("hidden", id !== formId);
  });
}

function setShopMode(mode, giftProvider = "") {
  clearStoreActiveState();

  const titles = {
    paypal: "PayPal",
    bizum: "Bizum",
    cash: "Retiro cajero / efectivo"
  };

  const subtitles = {
    paypal: "Retiro online con email PayPal",
    bizum: "Retiro en España con teléfono Bizum",
    cash: "Retiro manual en efectivo solo España"
  };

  if (mode === "paypal") {
    showOnlyShopForm("paypalForm");
    $("storeCardPaypal").classList.add("active");
    $("shopSelectedTitle").textContent = titles.paypal;
    $("shopSelectedSubtitle").textContent = subtitles.paypal;
  }

  if (mode === "bizum") {
    showOnlyShopForm("bizumForm");
    $("storeCardBizum").classList.add("active");
    $("shopSelectedTitle").textContent = titles.bizum;
    $("shopSelectedSubtitle").textContent = subtitles.bizum;
  }

  if (mode === "cash") {
    showOnlyShopForm("cashForm");
    $("storeCardCash").classList.add("active");
    $("shopSelectedTitle").textContent = titles.cash;
    $("shopSelectedSubtitle").textContent = subtitles.cash;
  }

  if (mode === "giftcard") {
    const provider = giftCardProviders[giftProvider] || giftCardProviders.amazon;
    const providerIdMap = {
      amazon: "storeCardAmazon",
      googleplay: "storeCardGooglePlay",
      steam: "storeCardSteam",
      apple: "storeCardApple",
      spotify: "storeCardSpotify"
    };

    showOnlyShopForm("giftCardForm");
    $(providerIdMap[giftProvider] || "storeCardAmazon").classList.add("active");
    $("giftCardProvider").value = giftProvider || "amazon";
    $("giftCardFormTitle").textContent = provider.title;
    $("giftCardWithdrawBtn").textContent = provider.button;
    $("shopSelectedTitle").textContent = provider.title;
    $("shopSelectedSubtitle").textContent = provider.subtitle;
  }

  if ($("shopMsg")) $("shopMsg").textContent = "";
  updateAmountPreviews();
}

$("storeCardPaypal").addEventListener("click", () => setShopMode("paypal"));
$("storeCardBizum").addEventListener("click", () => setShopMode("bizum"));
$("storeCardCash").addEventListener("click", () => setShopMode("cash"));

document.querySelectorAll(".gift-card-option").forEach(card => {
  card.addEventListener("click", () => {
    setShopMode("giftcard", card.dataset.giftProvider);
  });
});

$("paypalWithdrawBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("shopMsg").textContent = "Creando solicitud...";
    const data = await api("/api/shop/withdraw-paypal", {
      method: "POST",
      body: JSON.stringify({
        paypalEmail: $("paypalEmail").value,
        coins: Number($("withdrawCoinsPaypal").value)
      })
    });

    $("coinBalance").textContent = data.coins;
    $("shopMsg").textContent = `Solicitud de retiro creada: ${data.withdrawal.coins} monedas por PayPal. Estado: pendiente.`;
    await refreshMe();
    await loadMyWithdrawals();
  } catch (err) {
    $("shopMsg").textContent = err.message;
  }
});

$("bizumWithdrawBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("shopMsg").textContent = "Creando solicitud de Bizum...";
    const data = await api("/api/shop/withdraw-bizum", {
      method: "POST",
      body: JSON.stringify({
        bizumName: $("bizumName").value,
        bizumPhone: $("bizumPhone").value,
        coins: Number($("withdrawCoinsBizum").value)
      })
    });

    $("coinBalance").textContent = data.coins;
    $("shopMsg").textContent = `Solicitud de retiro creada: ${data.withdrawal.coins} monedas por Bizum. Estado: pendiente.`;
    await refreshMe();
    await loadMyWithdrawals();
  } catch (err) {
    $("shopMsg").textContent = err.message;
  }
});

$("cashWithdrawBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("shopMsg").textContent = "Creando solicitud de efectivo...";
    const data = await api("/api/shop/withdraw-cash-spain", {
      method: "POST",
      body: JSON.stringify({
        country: $("cashCountry").value,
        cashCity: $("cashCity").value,
        cashContact: $("cashContact").value,
        cashNotes: $("cashNotes").value,
        coins: Number($("withdrawCoinsCash").value)
      })
    });

    $("coinBalance").textContent = data.coins;
    $("shopMsg").textContent = `Solicitud de retiro creada: ${data.withdrawal.coins} monedas en efectivo para España. Estado: pendiente.`;
    await refreshMe();
    await loadMyWithdrawals();
  } catch (err) {
    $("shopMsg").textContent = err.message;
  }
});

$("giftCardWithdrawBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  const providerKey = $("giftCardProvider").value;
  const provider = giftCardProviders[providerKey] || giftCardProviders.amazon;

  try {
    $("shopMsg").textContent = `Creando solicitud de ${provider.title}...`;
    const data = await api("/api/shop/withdraw-gift-card", {
      method: "POST",
      body: JSON.stringify({
        provider: providerKey,
        giftCardEmail: $("giftCardEmail").value,
        giftCardNotes: $("giftCardNotes").value,
        coins: Number($("withdrawCoinsGiftCard").value)
      })
    });

    $("coinBalance").textContent = data.coins;
    $("shopMsg").textContent = `Solicitud creada: ${data.withdrawal.coins} monedas por ${provider.title}. Estado: pendiente.`;
    await refreshMe();
    await loadMyWithdrawals();
  } catch (err) {
    $("shopMsg").textContent = err.message;
  }
});

$("refreshShopWithdrawals")?.addEventListener("click", async () => {
  await loadMyWithdrawals();
});

document.querySelectorAll(".withdraw-coins-input").forEach(input => {
  input.addEventListener("input", updateAmountPreviews);
});

$("refreshProfileWithdrawals")?.addEventListener("click", async () => {
  await loadMyWithdrawals();
});


function resetOfferwallMessage() {
  if ($("offerwallMsg") && !$("offerwallMsg").textContent) {
    $("offerwallMsg").textContent = "Pulsa el botón para cargar las encuestas configuradas.";
  }
}

$("loadOfferwallBtn")?.addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("offerwallMsg").textContent = "Cargando offerwall...";
    const data = await api("/api/surveys/offerwall");

    if (!data.configured) {
      $("offerwallBox").classList.add("hidden");
      $("offerwallMsg").textContent = data.message || "Offerwall no configurado todavía.";
      return;
    }

    $("offerwallBox").classList.remove("hidden");
    $("offerwallFrame").src = data.url;
    $("offerwallMsg").textContent = `${data.name} cargado para tu usuario.`;
  } catch (err) {
    $("offerwallMsg").textContent = err.message;
  }
});

const puzzleData = [
  {
    id: "puzzle1",
    title: "Puzzle 1",
    pieces: ["👑", "🪙", "🎡", "📋", "🧠", "🔎", "🎁", "⭐", "💎"]
  },
  {
    id: "puzzle2",
    title: "Puzzle 2",
    pieces: ["A", "P", "P", "C", "A", "S", "H", "K", "G"]
  },
  {
    id: "puzzle3",
    title: "Puzzle 3",
    pieces: ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
  }
];

let currentPuzzleIndex = Number(localStorage.getItem("jck_current_puzzle_game") || 0);
if (!Number.isFinite(currentPuzzleIndex) || currentPuzzleIndex < 0 || currentPuzzleIndex >= puzzleData.length) {
  currentPuzzleIndex = 0;
}

let puzzleNextAvailableAt = Number(localStorage.getItem("jck_puzzle_next_available_at") || 0);
let puzzleNeedsUnityAd = localStorage.getItem("jck_puzzle_needs_unity_ad") === "true";

function shuffleArray(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function setPuzzleIndex(index) {
  currentPuzzleIndex = index;
  localStorage.setItem("jck_current_puzzle_game", String(currentPuzzleIndex));
  renderPuzzle();
}

function updatePuzzleCooldownText() {
  const remaining = puzzleNextAvailableAt - Date.now();

  if (remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    $("puzzleCooldownText").textContent = `${seconds}s`;
  } else {
    $("puzzleCooldownText").textContent = puzzleNeedsUnityAd ? "anuncio recompensado pendiente" : "Disponible";
  }

  $("puzzleUnityAdBtn").classList.toggle("hidden", !puzzleNeedsUnityAd);
}

function renderPuzzle() {
  const puzzle = puzzleData[currentPuzzleIndex];

  $("puzzleCurrentTitle").textContent = puzzle.title;

  ["puzzleSelect1", "puzzleSelect2", "puzzleSelect3"].forEach((id, idx) => {
    if ($(id)) $(id).classList.toggle("active", idx === currentPuzzleIndex);
  });

  const board = $("puzzleBoard");
  board.innerHTML = "";

  shuffleArray(puzzle.pieces).forEach(piece => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "puzzle-tile";
    tile.textContent = piece;
    tile.addEventListener("click", () => tile.classList.toggle("selected"));
    board.appendChild(tile);
  });

  updatePuzzleCooldownText();
}

$("puzzleSelect1")?.addEventListener("click", () => setPuzzleIndex(0));
$("puzzleSelect2")?.addEventListener("click", () => setPuzzleIndex(1));
$("puzzleSelect3")?.addEventListener("click", () => setPuzzleIndex(2));

$("completePuzzleBtn")?.addEventListener("click", async () => {
  if (!requireLogin()) return;

  const remaining = puzzleNextAvailableAt - Date.now();
  if (remaining > 0) {
    $("puzzleMsg").textContent = `Debes esperar ${Math.ceil(remaining / 1000)} segundos antes de completar otro puzzle.`;
    updatePuzzleCooldownText();
    return;
  }

  if (puzzleNeedsUnityAd) {
    $("puzzleMsg").textContent = "Antes de pasar al siguiente puzzle debes ver un anuncio recompensado recompensado.";
    $("puzzleUnityAdBtn").classList.remove("hidden");
    return;
  }

  try {
    const puzzle = puzzleData[currentPuzzleIndex];
    const data = await api("/api/puzzle/complete", {
      method: "POST",
      body: JSON.stringify({ puzzleId: puzzle.id })
    });

    $("coinBalance").textContent = data.coins;
    $("puzzleMsg").textContent = `${puzzle.title} completado. Ganaste ${data.added} coins. Ahora espera 2 minutos y mira un anuncio recompensado para el siguiente.`;

    puzzleNextAvailableAt = data.nextAvailableAt || (Date.now() + 2 * 60 * 1000);
    puzzleNeedsUnityAd = Boolean(data.needsUnityAdForNext);

    localStorage.setItem("jck_puzzle_next_available_at", String(puzzleNextAvailableAt));
    localStorage.setItem("jck_puzzle_needs_unity_ad", String(puzzleNeedsUnityAd));

    currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzleData.length;
    localStorage.setItem("jck_current_puzzle_game", String(currentPuzzleIndex));

    renderPuzzle();
    await refreshMe();
  } catch (err) {
    if (err.message.includes("anuncio recompensado")) {
      puzzleNeedsUnityAd = true;
      localStorage.setItem("jck_puzzle_needs_unity_ad", "true");
      $("puzzleUnityAdBtn").classList.remove("hidden");
    }

    $("puzzleMsg").textContent = err.message;
  }
});

$("puzzleUnityAdBtn")?.addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("puzzleUnityAdBtn").disabled = true;
    $("puzzleMsg").textContent = "Cargando 5 anuncios recompensados...";
    await showRewardedVignetteAd("Mira 5 anuncios para desbloquear el siguiente puzzle.", "puzzle");

    await api("/api/puzzle/unity-ad", { method: "POST" });

    puzzleNeedsUnityAd = false;
    localStorage.setItem("jck_puzzle_needs_unity_ad", "false");

    $("puzzleMsg").textContent = "Bloque de 5 anuncios validado. Cuando pasen los 2 minutos, podrás completar el siguiente puzzle.";
    updatePuzzleCooldownText();
    await refreshMe();
  } catch (err) {
    $("puzzleMsg").textContent = err.message;
  } finally {
    $("puzzleUnityAdBtn").disabled = false;
  }
});

setInterval(() => {
  if ($("puzzleCooldownText")) updatePuzzleCooldownText();
}, 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

setAuthMode("login");
renderQuiz();
renderWordGrid();
if ($("storeCardPaypal")) setShopMode("paypal");
refreshMe();
