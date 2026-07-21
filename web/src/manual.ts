export type ManualSection = { h: string; body: string[] };

export const MANUAL = {
  title: "Manual · HASHCOD did:web",
  subtitle: "Guía completa: identidad pública, .cod, privacidad y concatenación",
  sections: [
    {
      h: "1. ¿Qué es esta página?",
      body: [
        "Consola pública did:web de HASHCOD.",
        "DID: did:web:w129.github.io:hashcod-did-web → /did.json",
        "Solo material público: .cod públicos, archivos y concats.",
      ],
    },
    {
      h: "2. did:web",
      body: [
        "Identificador W3C anclado a un dominio HTTPS.",
        "did.json expone claves públicas Ed25519 y servicios (cods, files, concat, API).",
      ],
    },
    {
      h: "3. Consola HASHCOD → did:web",
      body: [
        "CLI: didweb publish <recibo.cod>",
        "Web: pegar JSON del .cod → Publish public .cod",
        "El servidor elimina campos privados (sanitize).",
      ],
    },
    {
      h: "4. Público vs privado",
      body: [
        "PÚBLICO: public_key_b64, firmas, hashes JCS, ciphertext opaco, VC pública.",
        "PRIVADO (nunca): ed25519_private, master.key, seeds, passwords, *.priv.",
        "Para concat se exigen public_keys del .cod — no las privadas.",
      ],
    },
    {
      h: "5. Flujo de trabajo",
      body: [
        "1) Generar .cod en brickplot/CLI",
        "2) Publicar solo la versión pública",
        "3) Opcional: subir archivo público",
        "4) Concat con ids de .cod + file (claves públicas del .cod)",
        "5) Verificar con verify / vc verify en local",
      ],
    },
    {
      h: "6. API",
      body: [
        "GET /api?action=status | list_cods | list_files | list_concat",
        "POST publish_cod | publish_file | concat",
        "GET /did.json",
      ],
    },
    {
      h: "7. Render / Pages",
      body: [
        "Repo: github.com/w129/hashcod-did-web",
        "Render: npm install + npm start (package.json en raíz)",
        "Pages: rama gh-pages",
      ],
    },
  ] as ManualSection[],
};
