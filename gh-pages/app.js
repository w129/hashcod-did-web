/* HASHCOD did:web SPA (vanilla) — tkinter white/black */
(function () {
  const API = (window.HASHCOD_API || "/api/index.php").replace(/\/?$/, "");
  const term = document.getElementById("term");
  const detail = document.getElementById("detail");

  function log(msg, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = msg;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  async function api(action, body) {
    const url = API + (API.includes("?") ? "&" : "?") + "action=" + encodeURIComponent(action);
    const opts = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        }
      : { method: "GET" };
    const res = await fetch(body ? API + "?action=" + encodeURIComponent(action) : url, opts);
    return res.json();
  }

  function renderList(el, items, onClick) {
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.textContent = "(empty)";
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
      document.getElementById("statusBadge").textContent = "offline";
    }
  }

  document.getElementById("btnRefresh").onclick = refresh;
  document.getElementById("btnDid").onclick = () => {
    window.open("did.json", "_blank");
  };

  document.getElementById("btnPublishCod").onclick = async () => {
    const raw = document.getElementById("codJson").value.trim();
    if (!raw) return log("✗ paste a .cod JSON first");
    let cod;
    try {
      cod = JSON.parse(raw);
    } catch (e) {
      return log("✗ invalid JSON");
    }
    log("hcod> publish public cod", "prompt");
    const r = await api("publish_cod", {
      cod,
      note: document.getElementById("codNote").value,
    });
    log(r.message || JSON.stringify(r));
    if (r.public_keys) {
      log("  public_keys: " + r.public_keys.length + " (private keys stripped)");
    }
    refresh();
  };

  document.getElementById("btnPublishFile").onclick = async () => {
    const content = document.getElementById("fileContent").value;
    const title = document.getElementById("fileTitle").value || "file.txt";
    log("hcod> publish file", "prompt");
    const r = await api("publish_file", {
      filename: title.endsWith(".txt") ? title : title + ".txt",
      title,
      content,
    });
    log(r.message || JSON.stringify(r));
    refresh();
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
    log("hcod> concat (public keys from .cod)", "prompt");
    const r = await api("concat", {
      cod_ids,
      file_ids,
      title: document.getElementById("concatTitle").value || "public-concat",
    });
    log(r.message || JSON.stringify(r));
    if (!r.ok) log("✗ " + (r.error || "failed"));
    refresh();
  };

  log("HASHCOD did:web console (public only)");
  log("Private keys belonging to .cod must never appear here.");
  refresh();
})();
