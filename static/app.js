/* HASHCOD did:web — live CLI feed + encrypted vault */
(function () {
  const STORAGE_KEY = "hashcod_didweb_hide_manual";
  const term = document.getElementById("term");
  const detail = document.getElementById("detail");
  const overlay = document.getElementById("manualOverlay");
  let lastActivityId = "";
  let pollTimer = null;

  function log(msg, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  function apiUrl(action) {
    return "/api?action=" + encodeURIComponent(action);
  }

  async function api(action, body) {
    const url = apiUrl(action);
    const opts = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        }
      : { method: "GET" };
    let res = await fetch(url, opts);
    if (!res.ok) {
      try {
        res = await fetch("/api/index.php?action=" + encodeURIComponent(action), opts);
      } catch (_) {}
    }
    return res.json();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderList(el, items, onClick, formatter) {
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.textContent = "(vacío)";
      el.appendChild(li);
      return;
    }
    items.forEach((it) => {
      const li = document.createElement("li");
      if (formatter) li.innerHTML = formatter(it);
      else {
        const id = it.id || it.name || "?";
        li.innerHTML =
          "<div>" +
          escapeHtml(id) +
          '</div><div class="meta">' +
          escapeHtml(it.command || it.title || it.filename || it.published_at || it.ts || "") +
          "</div>";
      }
      li.onclick = () => onClick(it, li);
      el.appendChild(li);
    });
  }

  function renderManual() {
    const man = window.HASHCOD_MANUAL || { title: "Manual", subtitle: "", sections: [] };
    document.getElementById("manualTitle").textContent = man.title;
    document.getElementById("manualSubtitle").textContent = man.subtitle;
    const body = document.getElementById("manualBody");
    body.innerHTML = "";
    (man.sections || []).forEach((sec) => {
      const h = document.createElement("h2");
      h.textContent = sec.h;
      body.appendChild(h);
      (sec.body || []).forEach((line) => {
        const p = document.createElement("p");
        if (/^\s{2}/.test(line) || /^(GET|POST|•|☐)/.test(line)) p.className = "line-code";
        p.textContent = line || " ";
        body.appendChild(p);
      });
    });
  }

  function openManual() {
    renderManual();
    overlay.hidden = false;
    document.body.classList.add("manual-open");
  }
  function closeManual() {
    const cb = document.getElementById("manualDontShow");
    if (cb.checked) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
    overlay.hidden = true;
    document.body.classList.remove("manual-open");
  }

  async function refreshActivity(silent) {
    try {
      const act = await api("activity");
      const items = act.items || [];
      renderList(
        document.getElementById("activityList"),
        items,
        (it) => {
          detail.textContent = JSON.stringify(it, null, 2);
        },
        (it) =>
          '<div class="cmd">' +
          escapeHtml(it.command || "?") +
          '</div><div class="meta">' +
          escapeHtml((it.ts || "") + " · " + (it.summary || it.description || "")) +
          "</div>"
      );
      if (items.length && items[0].id && items[0].id !== lastActivityId) {
        if (lastActivityId && !silent) {
          log("⚡ CLI · " + (items[0].command || items[0].id), "prompt");
          if (items[0].summary) log("  " + items[0].summary);
        }
        lastActivityId = items[0].id;
      }
      document.getElementById("liveBadge").textContent = "LIVE on";
      document.getElementById("liveBadge").classList.add("live-on");
    } catch (e) {
      document.getElementById("liveBadge").textContent = "LIVE off";
      document.getElementById("liveBadge").classList.remove("live-on");
    }
  }

  async function refresh() {
    log("hcod> refresh", "prompt");
    try {
      const st = await api("status");
      document.getElementById("statusBadge").textContent = st.message || "ready";
      log(st.message || JSON.stringify(st));

      await refreshActivity(true);

      const cods = await api("list_cods");
      renderList(document.getElementById("codList"), cods.items || [], async (it) => {
        const g = await api("get", { kind: "cod", id: it.id });
        detail.textContent = JSON.stringify(g.data || g, null, 2);
      });

      const files = await api("list_files");
      renderList(document.getElementById("fileList"), files.items || [], (it) => {
        detail.textContent = JSON.stringify(it, null, 2);
      });

      const vault = await api("vault_list");
      renderList(
        document.getElementById("vaultList"),
        vault.items || [],
        async (it) => {
          const g = await api("vault_get", { id: it.id });
          // show metadata + sealed headers only
          const v = g.vault || g;
          const view = {
            id: v.id,
            filename: v.filename,
            content_type: v.content_type,
            note: v.note,
            created_at: v.created_at,
            privacy: v.privacy,
            sealed: v.sealed
              ? {
                  alg: v.sealed.alg,
                  kdf: v.sealed.kdf,
                  plaintext_bytes: v.sealed.plaintext_bytes,
                  nonce_b64: v.sealed.nonce_b64,
                  salt_b64: v.sealed.salt_b64,
                  ciphertext_b64: (v.sealed.ciphertext_b64 || "").slice(0, 48) + "…",
                }
              : null,
          };
          detail.textContent = JSON.stringify(view, null, 2);
          document.getElementById("vaultOpenId").value = it.id;
        },
        (it) =>
          "<div>🔒 " +
          escapeHtml(it.filename || it.id) +
          '</div><div class="meta">' +
          escapeHtml(it.id + " · " + (it.plaintext_bytes || "?") + " bytes") +
          "</div>"
      );

      const conc = await api("list_concat");
      renderList(document.getElementById("concatList"), conc.items || [], async (it) => {
        const g = await api("get", { kind: "concat", id: it.id });
        detail.textContent = JSON.stringify(g.data || g, null, 2);
      });
    } catch (e) {
      log("✗ " + e.message);
      document.getElementById("statusBadge").textContent = "offline";
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function downloadBase64(filename, b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "file.bin";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById("btnRefresh").onclick = refresh;
  document.getElementById("btnDid").onclick = () => window.open("did.json", "_blank");
  document.getElementById("btnManual").onclick = openManual;
  document.getElementById("footerManual").onclick = (e) => {
    e.preventDefault();
    openManual();
  };
  document.getElementById("btnManualEnter").onclick = closeManual;
  document.getElementById("btnManualClose").onclick = closeManual;

  document.getElementById("btnVaultUpload").onclick = async () => {
    const input = document.getElementById("vaultFile");
    const file = input.files && input.files[0];
    const p1 = document.getElementById("vaultPassword").value;
    const p2 = document.getElementById("vaultPassword2").value;
    if (!file) return log("✗ selecciona un archivo");
    if (!p1) return log("✗ contraseña requerida");
    if (p1 !== p2) return log("✗ las contraseñas no coinciden");
    log("hcod> vault encrypt " + file.name, "prompt");
    try {
      const b64 = await fileToBase64(file);
      const r = await api("vault_store", {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        content_base64: b64,
        password: p1,
        note: document.getElementById("vaultNote").value,
      });
      log(r.message || JSON.stringify(r));
      if (r.ok) {
        document.getElementById("vaultPassword").value = "";
        document.getElementById("vaultPassword2").value = "";
        log("  ⚠ guarda la contraseña — no se almacena en el servidor");
      }
      refresh();
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  document.getElementById("btnVaultOpen").onclick = async () => {
    const id = document.getElementById("vaultOpenId").value.trim();
    const password = document.getElementById("vaultOpenPassword").value;
    if (!id || !password) return log("✗ id y contraseña requeridos");
    log("hcod> vault open " + id, "prompt");
    try {
      const r = await api("vault_decrypt", { id, password });
      if (!r.ok) {
        log("✗ " + (r.error || "falló"));
        return;
      }
      log(r.message || "ok");
      downloadBase64(r.filename, r.content_base64, r.content_type);
      document.getElementById("vaultOpenPassword").value = "";
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  document.getElementById("btnPublishCod").onclick = async () => {
    const raw = document.getElementById("codJson").value.trim();
    if (!raw) return log("✗ pega JSON .cod");
    try {
      const cod = JSON.parse(raw);
      log("hcod> publish public cod", "prompt");
      const r = await api("publish_cod", { cod, note: document.getElementById("codNote").value });
      log(r.message || JSON.stringify(r));
      refresh();
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  document.getElementById("btnPublishFile").onclick = async () => {
    log("hcod> publish file", "prompt");
    const title = document.getElementById("fileTitle").value || "file.txt";
    const r = await api("publish_file", {
      filename: title,
      title,
      content: document.getElementById("fileContent").value,
    });
    log(r.message || JSON.stringify(r));
    refresh();
  };

  document.getElementById("btnConcat").onclick = async () => {
    log("hcod> concat", "prompt");
    const r = await api("concat", {
      cod_ids: document.getElementById("concatCods").value.split(",").map((s) => s.trim()).filter(Boolean),
      file_ids: document.getElementById("concatFiles").value.split(",").map((s) => s.trim()).filter(Boolean),
      title: document.getElementById("concatTitle").value || "public-concat",
    });
    log(r.message || r.error || JSON.stringify(r));
    refresh();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeManual();
  });

  log("HASHCOD did:web · live CLI + vault cifrado");
  log("Cada hcod de la terminal se refleja en el feed (público).");
  log("Vault: cualquier formato · AES-256-GCM · solo con contraseña.");

  renderManual();
  if (localStorage.getItem(STORAGE_KEY) !== "1") openManual();
  else overlay.hidden = true;

  refresh();
  // live poll every 2.5s
  pollTimer = setInterval(() => refreshActivity(false), 2500);
})();
