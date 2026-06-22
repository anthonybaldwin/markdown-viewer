# Markdown Viewer

A Chrome extension (Manifest V3) that renders `.md` files in the browser — GFM,
YAML front matter, math (KaTeX + mhchem), syntax highlighting, and Mermaid
diagrams. Documents are sanitized with DOMPurify before display. Runs only on
sites you allow.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. For local files: open the extension's **Details** and turn on
   **Allow access to file URLs**.

`dist/` is committed, so there's no build step.

## Use

Click the toolbar icon and enable the extension per site — or enable
**Local files** for `file://` documents. Manage allowed sites and reading
options from the options page.

Recognized: `.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`, `.mdwn`, `.mdtxt`,
`.mdtext`, `.rmd`, `.qmd`, `.ronn`, `.workbook`, and anything served as
`text/markdown`.

## Develop

Requires [Bun](https://bun.sh).

```bash
bun install
bun run build    # build dist/ bundles + vendor KaTeX
bun run test     # sanitization tests
bun run demo     # live preview at http://localhost:8137
```

## License

MIT © Anthony Baldwin. Bundled libraries keep their own licenses — see
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).
