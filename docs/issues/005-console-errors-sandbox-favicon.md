# Issue 005: Browser Console Errors — Sandboxed Iframe Script Blocking & Missing Favicon

## Problem

The browser console shows 5 issues (3 errors, 2 warnings) on `http://localhost:3000/`:

### Error 1: Missing Favicon (404)
```
Failed to load resource: the server responded with a status of 404 (Not Found)
  :3000/favicon.ico
```
Browsers automatically request `/favicon.ico` on every page load. The Express static
middleware serves from `public/` but no favicon file exists there.

### Errors 2–3: Sandboxed Iframe Script Blocking (x2)
```
Blocked script execution in 'http://localhost:3000/' because the (index):1
document's frame is sandboxed and the 'allow-scripts' permission is not set.
```
Three iframes in `public/index.html` use `sandbox="allow-same-origin"`:
- `#offer-iframe` (line 79)
- `#deal-sheet-iframe` (line 91)
- `#client-offer-iframe` (line 103)

The `sandbox` attribute restricts iframe capabilities. `allow-same-origin` lets the
iframe share the parent's origin (needed for `doc.open()`/`doc.write()` from the
parent), but without `allow-scripts` the browser blocks any script execution
within the iframe's document context. The rendered HTML templates contain inline
`<style>` tags and the browser's content security model triggers these warnings
when it encounters content in a script-restricted sandbox.

## Root Cause

1. **Favicon**: No `favicon.ico` or `<link rel="icon">` tag exists in the project.
2. **Sandbox**: The `sandbox` attribute is too restrictive. The templates rendered
   inside the iframes are trusted internal content (server-generated HTML), so
   `allow-scripts` is safe to add. Alternatively, since the iframe content is
   entirely controlled by us (not user-submitted), the sandbox attribute can be
   removed entirely — it was added as a defensive measure but is unnecessary for
   server-rendered previews.

## Impact

- **Favicon 404**: Cosmetic — causes a failed network request on every page load.
- **Sandbox blocking**: The deal sheet and client offer templates use CSS-only
  styling so functionality isn't broken, but the console errors are noisy and
  could mask real issues during development.

## Affected Files

| File | Line(s) | Issue |
|------|---------|-------|
| `public/index.html` | 79, 91, 103 | `sandbox="allow-same-origin"` missing `allow-scripts` |
| `public/index.html` | `<head>` | No favicon `<link>` tag |
| `public/` | — | No `favicon.ico` file |
