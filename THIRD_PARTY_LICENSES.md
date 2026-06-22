# Third-party licenses

Markdown Viewer itself is MIT-licensed (see [LICENSE](./LICENSE)). It bundles
the following open-source libraries, all under permissive licenses compatible
with MIT redistribution. Their code is included in the built `dist/` bundles
and, for KaTeX, under `vendor/`.

| Library | Version | License | Copyright |
| --- | --- | --- | --- |
| [markdown-it](https://github.com/markdown-it/markdown-it) | 14.x | MIT | © 2014 Vitaly Puzrin, Alex Kocharin |
| markdown-it-footnote / -deflist / -sub / -sup / -mark / -ins / -abbr / -emoji | — | MIT | © markdown-it contributors |
| [@mdit/plugin-tasklist](https://github.com/mdit-plugins/mdit-plugins) | 0.23.x | MIT | © Mr.Hope |
| [markdown-it-texmath](https://github.com/goessner/markdown-it-texmath) | 1.x | MIT | © Stefan Goessner |
| [KaTeX](https://github.com/KaTeX/KaTeX) | 0.17.x | MIT | © 2013–2020 Khan Academy and other contributors |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 11.x | BSD-3-Clause | © 2006 Ivan Sagalaev |
| [Mermaid](https://github.com/mermaid-js/mermaid) | 11.x | MIT | © 2014–2022 Knut Sveidqvist |
| [DOMPurify](https://github.com/cure53/DOMPurify) | 3.x | Apache-2.0 OR MPL-2.0 | © Mario Heiderich and contributors |

Build-only tools (not bundled into the extension): esbuild (MIT), sharp
(Apache-2.0), jsdom (MIT).

## Notes on the non-MIT dependencies

**highlight.js — BSD-3-Clause.** Permissive; requires preserving the copyright
notice and disclaimer, reproduced below.

**DOMPurify — Apache-2.0 / MPL-2.0 (dual).** Permissive; the Apache-2.0 option
requires preserving the license and any NOTICE. DOMPurify is the security gate
of this project and has no equally-trusted MIT-licensed equivalent.

Full license texts ship with each package under `node_modules/<pkg>/LICENSE`.
The two non-MIT notices are reproduced here for convenience.

---

### highlight.js — BSD 3-Clause License

```
Copyright (c) 2006, Ivan Sagalaev.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
* Neither the name of the copyright holder nor the names of its contributors
  may be used to endorse or promote products derived from this software without
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### DOMPurify — Apache-2.0 / MPL-2.0

DOMPurify is dual-licensed under the Apache License, Version 2.0 and the
Mozilla Public License, Version 2.0. © Mario Heiderich and contributors.
Full text: <https://github.com/cure53/DOMPurify/blob/main/LICENSE>.
