# hashcod-did-web

**did:web:** `did:web:w129.github.io:hashcod-did-web`  
**Owner:** [w129](https://github.com/w129)

Public publication surface for HASHCOD CLI `.cod` receipts.

## Privacy rule

| Published | Never published |
|-----------|-----------------|
| `public_key_b64` (Ed25519) | Issuer/suite **private** keys |
| Public VC / commitments | `master.key`, `*.ed25519.priv` |
| Ciphertext (opaque) | Passwords, seeds, HMAC secrets |
| Concat integrity hashes | Any field named private/secret/seed |

To **concatenate** a public file into the did:web pack you must supply the **public keys that belong to the .cod** (listed in each `*.public.cod.json`). Private keys must not appear.

## Stack

| Layer | Tech |
|-------|------|
| Identity | did:web + Ed25519 public keys |
| API | PHP (`server/api`) |
| UI | React + TypeScript (`web/`) · static HTML/CSS fallback (`static/`) |
| Design | tkinter-like **white background / black UI** |
| Console bridge | `didweb publish` in HASHCOD CLI |

## Deploy on Render

This repo has a **root** `package.json` so Render finds the app at `/opt/render/project/src`.

| Setting | Value |
|---------|--------|
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Root directory | *(leave empty / `.`)* |

Or use the included `render.yaml` (Blueprint).

**Do not** set Root Directory to `web` unless you only want the Vite app.

## Local server (Node — same as Render)

```bash
npm install
npm start
# → http://127.0.0.1:8788
```

- Status: `http://127.0.0.1:8788/api?action=status`
- DID: `http://127.0.0.1:8788/did.json`
- UI: `http://127.0.0.1:8788/`

## Local API (PHP optional)

```bash
php -S 127.0.0.1:8788 router.php
```

## React UI

```bash
cd web
npm install
npm run dev
```

## From HASHCOD console

```text
didweb status
didweb publish 090_ip_resell-fee_....cod
didweb file readme.txt
didweb concat cods=<public_id> files=<file_id> title=pack
didweb sync
```

## GitHub Pages

After `didweb sync`, push `gh-pages/` contents to branch `gh-pages` (or `/docs`).

DID document URL:

`https://w129.github.io/hashcod-did-web/did.json`
