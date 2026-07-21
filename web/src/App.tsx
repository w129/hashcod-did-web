import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { MANUAL } from "./manual";

type Item = { id: string; title?: string; command?: string; published_at?: string; note?: string };

const STORAGE_KEY = "hashcod_didweb_hide_manual";

export default function App() {
  const [status, setStatus] = useState("…");
  const [cods, setCods] = useState<Item[]>([]);
  const [files, setFiles] = useState<Item[]>([]);
  const [concats, setConcats] = useState<Item[]>([]);
  const [log, setLog] = useState<string[]>([
    "HASHCOD did:web (React + TS) · tkinter white/black",
    "Private keys from .cod never publish here.",
  ]);
  const [detail, setDetail] = useState("Selecciona un elemento o abre el Manual…");
  const [codJson, setCodJson] = useState("");
  const [codNote, setCodNote] = useState("");
  const [fileTitle, setFileTitle] = useState("note.txt");
  const [fileContent, setFileContent] = useState("");
  const [concatCods, setConcatCods] = useState("");
  const [concatFiles, setConcatFiles] = useState("");
  const [concatTitle, setConcatTitle] = useState("public-concat");
  const [manualOpen, setManualOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [dontShow, setDontShow] = useState(false);

  const push = (m: string) => setLog((prev) => [...prev.slice(-200), m]);

  const refresh = useCallback(async () => {
    try {
      const st = await api<{ message?: string }>("status");
      setStatus(st.message || "ready");
      push(st.message || "status ok");
      const c = await api<{ items: Item[] }>("list_cods");
      setCods(c.items || []);
      const f = await api<{ items: Item[] }>("list_files");
      setFiles(f.items || []);
      const k = await api<{ items: Item[] }>("list_concat");
      setConcats(k.items || []);
    } catch (e: any) {
      setStatus("offline");
      push("✗ " + (e?.message || e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function closeManual() {
    if (dontShow) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setManualOpen(false);
  }

  async function openCod(id: string) {
    const g = await api<{ data?: unknown }>("get", { kind: "cod", id });
    setDetail(JSON.stringify(g.data ?? g, null, 2));
    push("opened " + id);
  }

  async function publishCod() {
    try {
      const cod = JSON.parse(codJson);
      push("hcod> publish public cod");
      const r = await api<{ ok: boolean; message?: string; public_keys?: unknown[]; error?: string }>(
        "publish_cod",
        { cod, note: codNote }
      );
      push(r.message || r.error || JSON.stringify(r));
      if (r.public_keys) push("  public_keys: " + (r.public_keys as unknown[]).length);
      refresh();
    } catch (e: any) {
      push("✗ " + (e?.message || e));
    }
  }

  async function publishFile() {
    push("hcod> publish file");
    const r = await api<{ message?: string; error?: string }>("publish_file", {
      filename: fileTitle,
      title: fileTitle,
      content: fileContent,
    });
    push(r.message || r.error || JSON.stringify(r));
    refresh();
  }

  async function doConcat() {
    push("hcod> concat (public keys from .cod)");
    const r = await api<{ ok: boolean; message?: string; error?: string }>("concat", {
      cod_ids: concatCods.split(",").map((s) => s.trim()).filter(Boolean),
      file_ids: concatFiles.split(",").map((s) => s.trim()).filter(Boolean),
      title: concatTitle,
    });
    push(r.message || r.error || JSON.stringify(r));
    refresh();
  }

  return (
    <>
      {manualOpen && (
        <div className="manual-overlay" role="dialog" aria-modal="true">
          <div className="manual-panel">
            <div className="manual-head">
              <div>
                <h1>{MANUAL.title}</h1>
                <div className="sub">{MANUAL.subtitle}</div>
              </div>
              <div className="row">
                <button type="button" className="primary" onClick={closeManual}>
                  Entrar a la consola
                </button>
                <button type="button" onClick={closeManual}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="manual-body">
              {MANUAL.sections.map((sec) => (
                <div key={sec.h}>
                  <h2>{sec.h}</h2>
                  {sec.body.map((line, i) => (
                    <p key={i} className={/^\s{2}|^GET|^POST|^•|^☐/.test(line) ? "line-code" : undefined}>
                      {line || "\u00a0"}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <div className="manual-foot">
              <label>
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                />{" "}
                No mostrar al entrar
              </label>
              <span className="badge">did:web:w129.github.io:hashcod-did-web</span>
            </div>
          </div>
        </div>
      )}

      <header className="app-head">
        <div>
          <h1>HASHCOD did:web · public-only</h1>
          <div className="sub">did:web:w129.github.io:hashcod-did-web</div>
        </div>
        <div className="row">
          <span className="badge">{status}</span>
          <button type="button" className="primary" onClick={() => setManualOpen(true)}>
            Manual
          </button>
          <button type="button" onClick={refresh}>
            Refresh
          </button>
          <button type="button" onClick={() => window.open("/did.json", "_blank")}>
            did.json
          </button>
        </div>
      </header>

      <div className="layout">
        <div className="col">
          <h2>Public .cod</h2>
          <div className="list">
            {cods.map((c) => (
              <div key={c.id} className="item" onClick={() => openCod(c.id)}>
                <div>{c.id}</div>
                <div className="meta">{c.command || c.published_at}</div>
              </div>
            ))}
            {!cods.length && <div className="item">(vacío)</div>}
          </div>
          <h2>Files</h2>
          <div className="list">
            {files.map((f) => (
              <div key={f.id} className="item" onClick={() => setDetail(JSON.stringify(f, null, 2))}>
                <div>{f.id}</div>
                <div className="meta">{f.title}</div>
              </div>
            ))}
            {!files.length && <div className="item">(vacío)</div>}
          </div>
          <h2>Concat</h2>
          <div className="list">
            {concats.map((k) => (
              <div
                key={k.id}
                className="item"
                onClick={async () => {
                  const g = await api("get", { kind: "concat", id: k.id });
                  setDetail(JSON.stringify(g.data ?? g, null, 2));
                }}
              >
                <div>{k.id}</div>
                <div className="meta">{k.title}</div>
              </div>
            ))}
            {!concats.length && <div className="item">(vacío)</div>}
          </div>
        </div>

        <div className="col">
          <h2>Terminal</h2>
          <div className="term">{log.join("\n")}</div>
          <div className="warn">
            <strong>Privacidad:</strong> solo material público. Las claves privadas del .cod no
            se publican. Concat exige <code>public_keys</code>.{" "}
            <button type="button" onClick={() => setManualOpen(true)}>
              Manual completo
            </button>
          </div>

          <h2>Publish public .cod</h2>
          <label>JSON</label>
          <textarea value={codJson} onChange={(e) => setCodJson(e.target.value)} />
          <label>Nota</label>
          <input value={codNote} onChange={(e) => setCodNote(e.target.value)} />
          <button type="button" className="primary" onClick={publishCod}>
            Publish public .cod
          </button>

          <h2>Add public file</h2>
          <label>Título</label>
          <input value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} />
          <label>Contenido</label>
          <textarea value={fileContent} onChange={(e) => setFileContent(e.target.value)} />
          <button type="button" onClick={publishFile}>
            Publish file
          </button>

          <h2>Concatenate</h2>
          <label>cod ids</label>
          <input value={concatCods} onChange={(e) => setConcatCods(e.target.value)} />
          <label>file ids</label>
          <input value={concatFiles} onChange={(e) => setConcatFiles(e.target.value)} />
          <label>Título</label>
          <input value={concatTitle} onChange={(e) => setConcatTitle(e.target.value)} />
          <button type="button" className="primary" onClick={doConcat}>
            Concat with public keys
          </button>
        </div>

        <div className="col">
          <h2>Detail</h2>
          <div className="term" style={{ minHeight: 480 }}>
            {detail}
          </div>
        </div>
      </div>

      <footer>
        w129/hashcod-did-web · React+TS · solo claves públicas ·{" "}
        <button type="button" onClick={() => setManualOpen(true)}>
          Manual
        </button>
      </footer>
    </>
  );
}
