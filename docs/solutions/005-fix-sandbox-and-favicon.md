# Solution 005: Fix Sandboxed Iframe Script Blocking & Missing Favicon

## References
- Problem: [docs/issues/005-console-errors-sandbox-favicon.md](../issues/005-console-errors-sandbox-favicon.md)

## Solution

### Fix 1: Add `allow-scripts` to iframe sandbox attributes

**File:** `public/index.html` (lines 79, 91, 103)

Change all three iframes from:
```html
sandbox="allow-same-origin"
```
to:
```html
sandbox="allow-same-origin allow-scripts"
```

**Rationale:** The iframe content is entirely server-generated trusted HTML (deal
sheets, offer previews). Adding `allow-scripts` permits the browser to process
inline styles and any dynamic content without triggering security warnings. The
remaining sandbox restrictions (no form submission, no popups, no top navigation)
still apply, keeping the iframes safely contained.

### Fix 2: Add a minimal inline SVG favicon

**File:** `public/index.html` — add to `<head>`

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F4C8;</text></svg>">
```

**Rationale:** An inline data URI favicon avoids adding a binary file to the repo
and eliminates the 404. Uses a chart emoji (relevant to equity mining). This can
be replaced with a proper `.ico` or `.png` file later when branding is finalized.

## Verification

After applying fixes, reload `http://localhost:3000/` and confirm:
- Browser console shows 0 errors
- Favicon appears in the browser tab
- Deal sheet and client offer modals still render correctly in iframes
