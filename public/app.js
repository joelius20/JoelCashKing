let token = localStorage.getItem("jck_token") || "";
let rouletteRotation = 0;
let currentUserData = null;

const $ = (id) => document.getElementById(id);

const quizQuestions = [
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
];

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
}

function renderQuiz() {
  $("quizContainer").innerHTML = quizQuestions.map((item, index) => `
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
    $("adMsg").textContent = "Simulando anuncio recompensado...";
    await new Promise(resolve => setTimeout(resolve, 1600));

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

  let correct = 0;
  quizQuestions.forEach((item, index) => {
    const checked = document.querySelector(`input[name="q${index}"]:checked`);
    if (checked && Number(checked.value) === item.answer) correct++;
  });

  try {
    const data = await api("/api/reward/quiz", {
      method: "POST",
      body: JSON.stringify({ correct, total: quizQuestions.length })
    });

    $("coinBalance").textContent = data.coins;
    alert(`Correctas: ${correct}/${quizQuestions.length}. Ganaste ${data.added} monedas.`);
    await refreshMe();
  } catch (err) {
    alert(err.message);
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
    $("unityAdMsg").textContent = `Unity Ads para próxima tirada extra: ${progress}/2.`;
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
      $("rouletteResult").textContent = `Tirada extra con Unity Ads. Premio: ${data.prize} 🪙.`;
    } else {
      $("rouletteResult").textContent = `Premio: ${data.prize} 🪙. Tiradas gratis restantes hoy: ${data.freeSpinsLeft}.`;
    }

    updateUnityAdUi(data);
    await refreshMe();
  } catch (err) {
    $("rouletteResult").textContent = err.message;

    if (err.message.includes("Unity Ads") || err.message.includes("tirada extra")) {
      $("unityAdBtn").classList.remove("hidden");
      $("unityAdMsg").textContent = "Necesitas ver 2 anuncios de Unity Ads para desbloquear una tirada extra.";
    }
  }
});

$("unityAdBtn").addEventListener("click", async () => {
  if (!requireLogin()) return;

  try {
    $("unityAdBtn").disabled = true;
    $("unityAdMsg").textContent = "Simulando Unity Ad...";
    await new Promise(resolve => setTimeout(resolve, 1600));

    const data = await api("/api/roulette/unity-ad", { method: "POST" });
    $("unityAdMsg").textContent = `Unity Ad visto. Progreso para tirada extra: ${data.rouletteUnityAds}/2.`;

    if (data.rouletteUnityAds >= 2) {
      $("unityAdMsg").textContent = "Ya tienes 2 Unity Ads vistos. Puedes girar una tirada extra.";
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

setAuthMode("login");
renderQuiz();
renderWordGrid();
if ($("storeCardPaypal")) setShopMode("paypal");
refreshMe();
