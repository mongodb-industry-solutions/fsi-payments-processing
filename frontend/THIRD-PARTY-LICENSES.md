# Third-Party Licenses — Frontend

This document contains the licenses for all third-party packages used in the frontend application.

Generated on: 2025-12-15

---

## Core Framework

### next (^15.5.11)
- **License:** MIT License
- **Repository:** https://github.com/vercel/next.js
- **Description:** React framework with App Router, server components, and file-based routing

### react (^19.1.1)
- **License:** MIT License
- **Repository:** https://github.com/facebook/react
- **Description:** Library for building user interfaces

### react-dom (^19.1.1)
- **License:** MIT License
- **Repository:** https://github.com/facebook/react
- **Description:** React package for DOM rendering

---

## MongoDB LeafyGreen UI Components

All `@leafygreen-ui` packages are part of [MongoDB's LeafyGreen Design System](https://github.com/mongodb/leafygreen-ui) and licensed under **Apache License 2.0**.

- **Repository:** https://github.com/mongodb/leafygreen-ui

| Package | Version |
| ---- | ---- |
| `@leafygreen-ui/badge` | ^10.1.1 |
| `@leafygreen-ui/banner` | ^10.0.5 |
| `@leafygreen-ui/button` | ^25.0.3 |
| `@leafygreen-ui/card` | ^13.0.4 |
| `@leafygreen-ui/code` | ^20.1.0 |
| `@leafygreen-ui/emotion` | ^5.0.1 |
| `@leafygreen-ui/icon` | ^14.4.1 |
| `@leafygreen-ui/icon-button` | ^17.0.4 |
| `@leafygreen-ui/leafygreen-provider` | ^5.0.3 |
| `@leafygreen-ui/lib` | ^15.2.1 |
| `@leafygreen-ui/modal` | ^20.0.2 |
| `@leafygreen-ui/palette` | ^5.0.1 |
| `@leafygreen-ui/polymorphic` | ^3.0.3 |
| `@leafygreen-ui/popover` | ^14.3.2 |
| `@leafygreen-ui/select` | ^16.1.1 |
| `@leafygreen-ui/table` | ^15.1.2 |
| `@leafygreen-ui/tabs` | ^17.0.2 |
| `@leafygreen-ui/text-area` | ^12.0.2 |
| `@leafygreen-ui/text-input` | ^16.0.2 |
| `@leafygreen-ui/tokens` | ^3.2.3 |
| `@leafygreen-ui/typography` | ^22.1.1 |

---

## Other Packages

### geist (^1.3.1)
- **License:** MIT License
- **Repository:** https://github.com/vercel/geist-font
- **Description:** Vercel's Geist font family

### polished (^4.3.1)
- **License:** MIT License
- **Repository:** https://github.com/styled-components/polished
- **Description:** Lightweight CSS-in-JS helper functions

### react-simple-maps (^3.0.0)
- **License:** MIT License
- **Repository:** https://github.com/zcreativelabs/react-simple-maps
- **Description:** SVG map components for React

### react-syntax-highlighter (^15.6.6)
- **License:** MIT License
- **Repository:** https://github.com/react-syntax-highlighter/react-syntax-highlighter
- **Description:** Syntax highlighting component for React

---

## Pinned Overrides

These transitive dependencies are pinned to specific versions for security:

### d3-color (^3.1.0)
- **License:** ISC License
- **Repository:** https://github.com/d3/d3-color
- **Description:** Color spaces and conversions (transitive dependency of react-simple-maps)

### prismjs (^1.30.0)
- **License:** MIT License
- **Repository:** https://github.com/PrismJS/prism
- **Description:** Syntax highlighting library (transitive dependency of react-syntax-highlighter)

### lodash (^4.17.23)
- **License:** MIT License
- **Repository:** https://github.com/lodash/lodash
- **Description:** Utility library (transitive dependency)

---

## License Texts

### Apache License 2.0

```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### MIT License

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC License

```text
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

## Notes

This file lists the direct dependencies and pinned overrides of the frontend application. Each dependency may have its own transitive dependencies with their own licenses. For complete license information, refer to the individual package repositories.

To verify or update this information:

- `license-checker` — generate licenses list: `npx license-checker --json`
- Check individual package metadata: `npm info <package-name> license`
