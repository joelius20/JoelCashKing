let adminKey = localStorage.getItem("jck_admin_key") || "";

const $ = (id) => document.getElementById(id);

if (adminKey) {
  $("adminKey").value = adminKey;
}

async function adminApi(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error inesperado.");
  return data;
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

async function loadStats() {
  const stats = await adminApi("/api/admin/stats");

  $("adminUsers").textContent = stats.usersCount;
  $("adminWithdrawals").textContent = stats.withdrawalsCount;
  $("adminPending").textContent = stats.pendingWithdrawals;
  $("adminPaid").textContent = stats.paidWithdrawals;
}

function taskStatusLabel(status) {
  const labels = {
    pending_review: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
    completed: "Completada"
  };
  return labels[status] || status;
}

async function loadTaskSubmissions() {
  if (!adminKey) return;

  try {
    const data = await adminApi("/api/admin/task-submissions");
    const list = $("adminTaskSubmissions");

    if (!list) return;

    if (!data.submissions.length) {
      list.innerHTML = `<div class="withdrawal-empty">No hay trabajos enviados.</div>`;
      return;
    }

    list.innerHTML = data.submissions.map(item => `
      <article class="admin-item">
        <div>
          <strong>${item.taskTitle}</strong>
          <span>Usuario: ${item.username} · ${item.email || ""}</span>
          <span>Recompensa: ${item.rewardCoins} coins</span>
          <span>Estado: ${taskStatusLabel(item.status)}</span>
          <span>Prueba: ${item.proofText || "Sin texto"}</span>
          ${item.proofUrl ? `<span>URL: <a href="${item.proofUrl}" target="_blank" rel="noopener">Abrir prueba</a></span>` : ""}
          ${item.adminNote ? `<span>Nota admin: ${item.adminNote}</span>` : ""}
          <span>Fecha: ${new Date(item.createdAt).toLocaleString()}</span>
        </div>

        <div class="admin-actions">
          <input id="taskNote-${item.id}" placeholder="Nota admin opcional">
          <button onclick="updateTaskStatus('${item.id}', 'approved')">Aprobar + coins</button>
          <button onclick="updateTaskStatus('${item.id}', 'completed')">Completar</button>
          <button onclick="updateTaskStatus('${item.id}', 'rejected')">Rechazar</button>
        </div>
      </article>
    `).join("");
  } catch (err) {
    alert(err.message);
  }
}

async function updateTaskStatus(id, status) {
  const noteInput = document.getElementById(`taskNote-${id}`);
  const adminNote = noteInput ? noteInput.value : "";

  try {
    await adminApi(`/api/admin/task-submissions/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, adminNote })
    });

    await loadTaskSubmissions();
    await loadStats();
  } catch (err) {
    alert(err.message);
  }
}

async function loadWithdrawals() {
  const data = await adminApi("/api/admin/withdrawals");
  const box = $("withdrawalsAdminList");

  if (!data.withdrawals.length) {
    box.innerHTML = `<p class="muted">No hay solicitudes todavía.</p>`;
    return;
  }

  box.innerHTML = data.withdrawals.map(w => `
    <div class="withdrawal-item">
      <strong>${w.username} · ${w.coins} 🪙 · ${w.estimatedEuro.toFixed(2)} ${w.currency}</strong>
      <span class="status-pill ${statusClass(w.status)}">${statusLabel(w.status)}</span>

      <div class="withdrawal-meta">
        <span>Usuario email: ${w.email}</span>
        ${w.paypalEmail ? `<span>PayPal: ${w.paypalEmail}</span>` : ""}
        ${w.bizumName ? `<span>Titular Bizum: ${w.bizumName}</span>` : ""}
        ${w.bizumPhone ? `<span>Teléfono Bizum: ${w.bizumPhone}</span>` : ""}
        ${w.giftCardProvider ? `<span>Tarjeta regalo: ${w.giftCardProvider}</span>` : ""}
        ${w.giftCardEmail ? `<span>Email de entrega: ${w.giftCardEmail}</span>` : ""}
        ${w.giftCardNotes ? `<span>Notas tarjeta: ${w.giftCardNotes}</span>` : ""}
        ${w.country ? `<span>País: ${w.country}</span>` : ""}
        ${w.cashCity ? `<span>Ciudad/zona: ${w.cashCity}</span>` : ""}
        ${w.cashContact ? `<span>Contacto: ${w.cashContact}</span>` : ""}
        ${w.cashNotes ? `<span>Notas efectivo: ${w.cashNotes}</span>` : ""}
        <span>Creada: ${new Date(w.createdAt).toLocaleString()}</span>
        <span>Actualizada: ${new Date(w.updatedAt).toLocaleString()}</span>
        ${w.adminNote ? `<span>Nota: ${w.adminNote}</span>` : ""}
      </div>

      <div class="admin-actions">
        <button class="small-button" data-id="${w.id}" data-status="approved">Aprobar</button>
        <button class="small-button" data-id="${w.id}" data-status="paid">Marcar completado</button>
        <button class="small-button" data-id="${w.id}" data-status="rejected">Rechazar</button>
        <button class="small-button" data-id="${w.id}" data-status="pending_review">Pendiente</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-status]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const adminNote = btn.dataset.status === "rejected"
        ? prompt("Motivo del rechazo:", "Actividad pendiente de revisar") || ""
        : "";

      try {
        await adminApi(`/api/admin/withdrawals/${btn.dataset.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: btn.dataset.status,
            adminNote
          })
        });

        $("adminMsg").textContent = "Solicitud actualizada.";
        await loadDashboard();
      } catch (err) {
        $("adminMsg").textContent = err.message;
      }
    });
  });
}

async function loadDashboard() {
  $("adminPanel").classList.remove("hidden");
  await loadStats();
  await loadTaskSubmissions();
  await loadWithdrawals();
}

$("saveAdminKey").addEventListener("click", async () => {
  adminKey = $("adminKey").value.trim();
  localStorage.setItem("jck_admin_key", adminKey);

  try {
    $("adminMsg").textContent = "Cargando dashboard...";
    await loadDashboard();
    $("adminMsg").textContent = "Dashboard cargado.";
  } catch (err) {
    $("adminMsg").textContent = err.message;
    $("adminPanel").classList.add("hidden");
  }
});

$("refreshAdmin").addEventListener("click", async () => {
  try {
    await loadDashboard();
    $("adminMsg").textContent = "Datos actualizados.";
  } catch (err) {
    $("adminMsg").textContent = err.message;
  }
});

if (adminKey) {
  loadDashboard().catch(() => {});
}
