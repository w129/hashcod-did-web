/* HASHCOD did:web SPA — tkinter white/black + manual al entrar */
(function () {
  const API = (window.HASHCOD_API || "/api").replace(/\/?$/, "");
  const STORAGE_KEY = "hashcod_didweb_hide_manual";
  const term = document.getElementById("term");
  const detail = document.getElementById("detail");
  const overlay = document.getElementById("manualOverlay");

  function log(msg, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  function apiUrl(action) {
    const base = API.includes("index.php") ? API : API + (API.endsWith("api") ? "" : "");
    // Prefer /api?action= for Node; also try /api/index.php for PHP
    if (base.includes("index.php")) {
      return base + (base.includes("?") ? "&" : "?") + "action=" + encodeURIComponent(action);
    }
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
    if (!res.ok && !body) {
      // fallback PHP path
      res = await fetch("/api/index.php?action=" + encodeURIComponent(action), opts);
    }
    return res.json();
  }

  function renderList(el, items, onClick) {
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.textContent = "(vacío)";
      el.appendChild(li);
      return;
    }
    items.forEach((it) => {
      const li = document.createElement("li");
      const id = it.id || it.name || "?";
      li.innerHTML =
        "<div>" +
        escapeHtml(id) +
        '</div><div class="meta">' +
        escapeHtml(it.command || it.title || it.published_at || "") +
        "</div>";
      li.onclick = () => onClick(it, li);
      el.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
        if (/^\s{2}/.test(line) || line.startsWith("GET") || line.startsWith("POST") || line.startsWith("•") || line.startsWith("☐")) {
          p.className = "line-code";
        }
        p.textContent = line || " ";
        body.appendChild(p);
      });
    });
  }

  function openManual() {
    renderManual();
    overlay.hidden = false;
    document.body.classList.add("manual-open");
    const cb = document.getElementById("manualDontShow");
    cb.checked = localStorage.getItem(STORAGE_KEY) === "1";
  }

  function closeManual() {
    const cb = document.getElementById("manualDontShow");
    if (cb.checked) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
    overlay.hidden = true;
    document.body.classList.remove("manual-open");
  }

  async function refresh() {
    log("hcod> refresh", "prompt");
    try {
      const st = await api("status");
      document.getElementById("statusBadge").textContent = st.message || "ready";
      log(st.message || JSON.stringify(st));

      const cods = await api("list_cods");
      renderList(document.getElementById("codList"), cods.items || [], async (it) => {
        const g = await api("get", { kind: "cod", id: it.id });
        detail.textContent = JSON.stringify(g.data || g, null, 2);
        log("opened cod " + it.id);
      });

      const files = await api("list_files");
      renderList(document.getElementById("fileList"), files.items || [], async (it) => {
        detail.textContent = JSON.stringify(it, null, 2);
        log("file " + it.id);
      });

      const conc = await api("list_concat");
      renderList(document.getElementById("concatList"), conc.items || [], async (it) => {
        const g = await api("get", { kind: "concat", id: it.id });
        detail.textContent = JSON.stringify(g.data || g, null, 2);
        log("concat " + it.id);
      });
    } catch (e) {
      log("✗ " + e.message);
      document.getElementById("statusBadge").textContent = "offline / sin API";
      log("(UI estática OK — el manual funciona sin API)");
    }
  }

  document.getElementById("btnRefresh").onclick = refresh;
  document.getElementById("btnDid").onclick = () => window.open("did.json", "_blank");
  document.getElementById("btnManual").onclick = openManual;
  document.getElementById("btnManualInline").onclick = openManual;
  document.getElementById("footerManual").onclick = (e) => {
    e.preventDefault();
    openManual();
  };
  document.getElementById("btnManualEnter").onclick = closeManual;
  document.getElementById("btnManualClose").onclick = closeManual;
  document.getElementById("manualDontShow").onchange = function () {
    if (this.checked) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  };

  document.getElementById("btnPublishCod").onclick = async () => {
    const raw = document.getElementById("codJson").value.trim();
    if (!raw) return log("✗ pega un JSON .cod primero");
    let cod;
    try {
      cod = JSON.parse(raw);
    } catch (e) {
      return log("✗ JSON inválido");
    }
    log("hcod> publish public cod", "prompt");
    try {
      const r = await api("publish_cod", {
        cod,
        note: document.getElementById("codNote").value,
      });
      log(r.message || JSON.stringify(r));
      if (r.public_keys) log("  public_keys: " + r.public_keys.length + " (privadas eliminadas)");
      refresh();
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  document.getElementById("btnPublishFile").onclick = async () => {
    const content = document.getElementById("fileContent").value;
    const title = document.getElementById("fileTitle").value || "file.txt";
    log("hcod> publish file", "prompt");
    try {
      const r = await api("publish_file", {
        filename: title.endsWith(".txt") ? title : title + ".txt",
        title,
        content,
      });
      log(r.message || JSON.stringify(r));
      refresh();
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  document.getElementById("btnConcat").onclick = async () => {
    const cod_ids = document
      .getElementById("concatCods")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const file_ids = document
      .getElementById("concatFiles")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    log("hcod> concat (claves públicas del .cod)", "prompt");
    try {
      const r = await api("concat", {
        cod_ids,
        file_ids,
        title: document.getElementById("concatTitle").value || "public-concat",
      });
      log(r.message || JSON.stringify(r));
      if (!r.ok) log("✗ " + (r.error || "falló"));
      refresh();
    } catch (e) {
      log("✗ " + e.message);
    }
  };

  // Escape cierra manual
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeManual();
  });

  log("HASHCOD did:web · consola pública");
  log("Las claves privadas del .cod no deben publicarse aquí.");

  // Mostrar manual al entrar (salvo preferencia del usuario)
  renderManual();
  if (localStorage.getItem(STORAGE_KEY) !== "1") {
    openManual();
  } else {
    overlay.hidden = true;
  }

  refresh();
})();
