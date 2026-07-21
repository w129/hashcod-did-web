/**
 * HASHCOD did:web — Node server for Render + local.
 * Serves static UI, did.json, public data, and JSON API.
 * Private keys are never accepted or stored.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8788;
const ROOT = __dirname;
const DATA = path.join(ROOT, "server", "data");
const STATIC = path.join(ROOT, "static");

const PRIVATE_NAMES = new Set([
  "private",
  "private_key",
  "private_key_b64",
  "secret",
  "secret_key",
  "seed",
  "master_key",
  "hmac_secret",
  "ed25519_private",
  "sk",
  "priv",
  "shares_b64",
  "password",
  "api_key",
  "token_secret",
]);

function ensureDirs() {
  for (const d of ["cods", "files", "concat"]) {
    const p = path.join(DATA, d);
    fs.mkdirSync(p, { recursive: true });
  }
}

function isPrivateName(name) {
  const n = String(name || "").toLowerCase();
  if (PRIVATE_NAMES.has(n)) return true;
  if (n.endsWith("_private") || n.endsWith("_priv") || n.endsWith("_secret")) return true;
  if (n.includes("private_key") || n.includes("master_key")) return true;
  if (n.includes(".priv") || n.includes("private.key")) return true;
  return false;
}

function sanitizePublic(obj, depth = 0) {
  if (depth > 40) return null;
  if (obj === null || typeof obj === "boolean" || typeof obj === "number") return obj;
  if (typeof obj === "string") {
    const low = obj.replace(/\\/g, "/").toLowerCase();
    for (const m of ["ed25519_private", "master.key", ".ed25519.priv", "private.key"]) {
      if (low.includes(m)) return "[REDACTED_PRIVATE_PATH]";
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((x) => sanitizePublic(x, depth + 1));
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isPrivateName(k)) continue;
      out[k] = sanitizePublic(v, depth + 1);
    }
    return out;
  }
  return String(obj);
}

function readJson(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function sha512(buf) {
  return crypto.createHash("sha512").update(buf).digest("hex");
}

function walkPublicKeys(node, pathKeys = [], out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkPublicKeys(v, pathKeys.concat(String(i)), out));
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    const p = pathKeys.concat(k);
    if (k === "public_key_b64" && typeof v === "string" && v.length > 20) {
      out.push({ path: p.join("."), public_key_b64: v, alg: "Ed25519" });
    }
    if (v && typeof v === "object") walkPublicKeys(v, p, out);
  }
  return out;
}

function uniqKeys(keys) {
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    if (!k.public_key_b64 || seen.has(k.public_key_b64)) continue;
    seen.add(k.public_key_b64);
    out.push(k);
  }
  return out;
}

function loadDid() {
  const candidates = [
    path.join(ROOT, "did.json"),
    path.join(ROOT, "server", "public", "did.json"),
    path.join(ROOT, "gh-pages", "did.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return readJson(p, null);
  }
  return {
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: "did:web:w129.github.io:hashcod-did-web",
    verificationMethod: [],
    hashcod: { privacy: "public_only", note: "publish a public .cod to populate keys" },
  };
}

ensureDirs();
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// DID
app.get(["/did.json", "/.well-known/did.json"], (req, res) => {
  res.json(loadDid());
});

// Data files
app.use("/data", express.static(DATA, { fallthrough: true }));

// API
function apiHandler(req, res) {
  const action = String(
    req.query.action || req.body?.action || "status"
  ).toLowerCase();
  try {
    if (action === "status") {
      const nCod = fs.readdirSync(path.join(DATA, "cods")).filter((f) =>
        f.endsWith(".public.cod.json")
      ).length;
      const nFiles = fs
        .readdirSync(path.join(DATA, "files"))
        .filter((f) => f !== "index.json" && !f.endsWith(".meta.json") && !f.startsWith("."))
        .length;
      const nConcat = fs
        .readdirSync(path.join(DATA, "concat"))
        .filter((f) => f.startsWith("concat_") && f.endsWith(".json") && !f.includes(".stream"))
        .length;
      return res.json({
        ok: true,
        service: "hashcod-did-web",
        privacy: "public_only",
        public_cods: nCod,
        public_files: nFiles,
        concats: nConcat,
        did: "did:web:w129.github.io:hashcod-did-web",
        host: "render/node",
        message: `did:web API · ${nCod} public cods · ${nFiles} files · ${nConcat} concats`,
      });
    }

    if (action === "list_cods" || action === "cods") {
      const idx = readJson(path.join(DATA, "cods", "index.json"), { items: [] });
      return res.json({ ok: true, items: idx.items || [], count: (idx.items || []).length });
    }

    if (action === "list_files" || action === "files") {
      const idx = readJson(path.join(DATA, "files", "index.json"), { items: [] });
      return res.json({ ok: true, items: idx.items || [], count: (idx.items || []).length });
    }

    if (action === "list_concat" || action === "concats") {
      const dir = path.join(DATA, "concat");
      const items = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith("concat_") && f.endsWith(".json") && !f.includes(".stream"))
        .map((f) => {
          const j = readJson(path.join(dir, f), {});
          return {
            id: f,
            title: j.title || f,
            created_at: j.created_at || null,
            concat_sha512: j.concat_sha512 || null,
            public_keys_n: (j.public_keys_required || []).length,
            parts_n: (j.parts || []).length,
          };
        })
        .sort((a, b) => (a.id < b.id ? 1 : -1));
      return res.json({ ok: true, items, count: items.length });
    }

    if (action === "get") {
      const kind = req.body?.kind || req.query.kind || "cod";
      const id = String(req.body?.id || req.query.id || "");
      if (!id || id.includes("..")) return res.status(400).json({ ok: false, error: "bad id" });
      const map = {
        cod: path.join(DATA, "cods", id),
        file: path.join(DATA, "files", id),
        concat: path.join(DATA, "concat", id),
      };
      const p = map[kind];
      if (!p || !fs.existsSync(p)) return res.status(404).json({ ok: false, error: "not found" });
      if (kind === "file" && !id.endsWith(".json")) {
        const bin = fs.readFileSync(p);
        return res.json({
          ok: true,
          kind: "file",
          id,
          bytes: bin.length,
          sha512: sha512(bin),
          content_base64: bin.toString("base64"),
        });
      }
      return res.json({ ok: true, kind, id, data: readJson(p, {}) });
    }

    if (action === "publish_cod" || action === "publish") {
      const cod = req.body?.cod || req.body?.document;
      if (!cod || typeof cod !== "object") {
        return res.status(400).json({ ok: false, error: "cod object required" });
      }
      const publicDoc = sanitizePublic(cod);
      let bundle;
      if (publicDoc.type === "hashcod.public_cod/v1") {
        bundle = publicDoc;
      } else {
        const keys = uniqKeys(walkPublicKeys(publicDoc));
        bundle = {
          type: "hashcod.public_cod/v1",
          published_at: new Date().toISOString(),
          privacy: "public_only",
          redaction: {
            policy: "strip_private_keys_and_secret_paths",
            note: "Private keys belonging to .cod must not appear on did:web.",
          },
          public_keys: keys,
          cod: publicDoc,
          publisher_note: req.body?.note || "",
        };
        const canon = JSON.stringify(bundle);
        bundle.integrity = {
          public_bundle_sha512: sha512(Buffer.from(canon)),
          original_payload_jcs_sha512:
            publicDoc.payload_jcs_sha512 || publicDoc.payload_sha512 || null,
          original_signature_ed25519_b64: publicDoc.signature_ed25519_b64 || null,
        };
      }
      const id =
        String(req.body?.id || "cod")
          .replace(/[^\w.\-]+/g, "_")
          .slice(0, 40) +
        "_" +
        new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 15) +
        "_" +
        crypto.randomBytes(2).toString("hex") +
        ".public.cod.json";
      writeJson(path.join(DATA, "cods", id), bundle);
      const idxPath = path.join(DATA, "cods", "index.json");
      const idx = readJson(idxPath, { items: [] });
      idx.items = idx.items || [];
      idx.items.unshift({
        id,
        published_at: bundle.published_at || new Date().toISOString(),
        public_keys_n: (bundle.public_keys || []).length,
        sha512: bundle.integrity?.public_bundle_sha512 || null,
        command: bundle.cod?.command || null,
        note: req.body?.note || "",
      });
      idx.items = idx.items.slice(0, 500);
      idx.updated_at = new Date().toISOString();
      idx.count = idx.items.length;
      writeJson(idxPath, idx);
      return res.json({
        ok: true,
        id,
        public_keys: bundle.public_keys || [],
        message: `published ${id}`,
      });
    }

    if (action === "publish_file" || action === "upload") {
      const name = req.body?.filename || "upload.bin";
      if (isPrivateName(name)) {
        return res.status(400).json({ ok: false, error: "refusing private key filename" });
      }
      let bin;
      if (req.body?.content_base64) {
        bin = Buffer.from(req.body.content_base64, "base64");
      } else if (req.body?.content != null) {
        bin = Buffer.from(String(req.body.content), "utf8");
      } else {
        return res.status(400).json({ ok: false, error: "content or content_base64 required" });
      }
      const safe =
        new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 15) +
        "_" +
        String(name).replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const filePath = path.join(DATA, "files", safe);
      fs.writeFileSync(filePath, bin);
      const meta = {
        id: safe,
        title: req.body?.title || name,
        original_name: name,
        bytes: bin.length,
        sha512: sha512(bin),
        published_at: new Date().toISOString(),
        privacy: "public_file",
      };
      writeJson(filePath + ".meta.json", meta);
      const idxPath = path.join(DATA, "files", "index.json");
      const idx = readJson(idxPath, { items: [] });
      idx.items = idx.items || [];
      idx.items.unshift(meta);
      idx.items = idx.items.slice(0, 500);
      idx.updated_at = new Date().toISOString();
      writeJson(idxPath, idx);
      return res.json({ ok: true, file: meta, message: `published file ${safe}` });
    }

    if (action === "concat") {
      const fileIds = req.body?.file_ids || [];
      const codIds = req.body?.cod_ids || [];
      const title = req.body?.title || "concat-public";
      if (!fileIds.length && !codIds.length) {
        return res.status(400).json({ ok: false, error: "file_ids and/or cod_ids required" });
      }
      const parts = [];
      const keys = [];
      for (const cid of codIds) {
        let p = path.join(DATA, "cods", cid);
        if (!fs.existsSync(p)) {
          const hits = fs
            .readdirSync(path.join(DATA, "cods"))
            .filter((f) => f.includes(String(cid).replace(/[^\w.\-]+/g, "")));
          if (!hits.length) return res.status(404).json({ ok: false, error: `public cod not found: ${cid}` });
          p = path.join(DATA, "cods", hits[0]);
        }
        const bundle = readJson(p, {});
        const pks = bundle.public_keys || [];
        if (!pks.length) {
          return res
            .status(400)
            .json({ ok: false, error: `${path.basename(p)} has no public_keys — cannot concat` });
        }
        keys.push(...pks);
        parts.push({
          kind: "public_cod",
          id: path.basename(p),
          sha512: bundle.integrity?.public_bundle_sha512 || null,
          public_keys: pks,
          command: bundle.cod?.command || null,
        });
      }
      for (const fid of fileIds) {
        const p = path.join(DATA, "files", fid);
        if (!fs.existsSync(p)) return res.status(404).json({ ok: false, error: `file not found: ${fid}` });
        const bin = fs.readFileSync(p);
        parts.push({
          kind: "public_file",
          id: path.basename(p),
          sha512: sha512(bin),
          bytes: bin.length,
        });
      }
      const uniq = uniqKeys(keys);
      const doc = {
        type: "hashcod.did_web.concat/v1",
        title,
        created_at: new Date().toISOString(),
        privacy: "public_only",
        rule: "Concat requires public_keys from referenced .cod (never private keys).",
        public_keys_required: uniq,
        parts,
      };
      doc.concat_sha512 = sha512(Buffer.from(JSON.stringify(doc)));
      const id =
        "concat_" +
        new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 15) +
        "_" +
        crypto.randomBytes(3).toString("hex") +
        ".json";
      writeJson(path.join(DATA, "concat", id), doc);
      return res.json({
        ok: true,
        id,
        public_keys_n: uniq.length,
        parts_n: parts.length,
        concat_sha512: doc.concat_sha512,
        message: `concat published with ${uniq.length} public key(s)`,
      });
    }

    if (action === "did") {
      return res.json(loadDid());
    }

    return res.status(400).json({ ok: false, error: `unknown action: ${action}` });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

app.all("/api", apiHandler);
app.all("/api/", apiHandler);
app.all("/api/index.php", apiHandler);

// Static UI (tkinter white/black)
app.use(express.static(STATIC));
app.get("*", (req, res) => {
  const index = path.join(STATIC, "index.html");
  if (fs.existsSync(index)) return res.sendFile(index);
  res
    .type("html")
    .send(
      `<!doctype html><html><body style="font-family:Consolas,monospace;background:#fff;color:#000"><h1>HASHCOD did:web</h1><p>API: <code>/api?action=status</code></p><p>DID: <code>/did.json</code></p></body></html>`
    );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HASHCOD did:web listening on 0.0.0.0:${PORT}`);
  console.log(`privacy=public_only data=${DATA}`);
});
