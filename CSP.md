# Content Security Policy (CSP) Configuration

## Overview

This application implements a Content Security Policy to protect against XSS (Cross-Site Scripting) and other code injection attacks.

## Current CSP Configuration

Located in `index.html`, the CSP meta tag defines the following policy:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' ws: wss:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

## Directive Breakdown

### `default-src 'self'`

Default fallback for all resource types. Only allows resources from the same origin.

### `script-src 'self' 'unsafe-inline'`

- `'self'`: Allows scripts from the same origin
- `'unsafe-inline'`: Required for Vite's development mode and React's inline event handlers
- **Note**: In a stricter production environment, consider using nonces or hashes instead of `'unsafe-inline'`

### `style-src 'self' 'unsafe-inline'`

- `'self'`: Allows stylesheets from the same origin
- `'unsafe-inline'`: Required for CSS Modules and inline styles in React components

### `img-src 'self' data: blob:`

- `'self'`: Allows images from the same origin
- `data:`: Allows data URIs (for inline images)
- `blob:`: Allows blob URLs (for dynamically generated images)

### `font-src 'self' data:`

- `'self'`: Allows fonts from the same origin
- `data:`: Allows data URIs for embedded fonts

### `connect-src 'self' ws: wss:`

- `'self'`: Allows AJAX, WebSocket, and fetch requests to the same origin
- `ws:` / `wss:`: Required for Vite's Hot Module Replacement (HMR) in development

### `object-src 'none'`

Disables plugins like Flash, Java, and other embedded objects.

### `base-uri 'self'`

Restricts the URLs that can be used in the `<base>` element.

### `form-action 'self'`

Restricts form submission targets to the same origin.

### `frame-ancestors 'none'`

Prevents the page from being embedded in iframes (clickjacking protection).
Equivalent to `X-Frame-Options: DENY`.

### `upgrade-insecure-requests`

Automatically upgrades HTTP requests to HTTPS when served over HTTPS.

## Development vs Production

### Current Configuration

The current CSP is permissive to support:

- Vite's development server and HMR
- React's inline event handlers
- CSS Modules with dynamic styles

### Stricter Production CSP (Future Enhancement)

For enhanced security in production, consider:

1. **Remove `'unsafe-inline'` from `script-src`:**

   - Use nonces: `script-src 'self' 'nonce-{random}'`
   - Or use hashes for specific inline scripts
   - Configure Vite to inject nonces

2. **Remove `'unsafe-inline'` from `style-src`:**

   - Extract all styles to external CSS files
   - Use nonces or hashes for critical inline styles

3. **Add `script-src-elem` and `script-src-attr`:**

   - Separate policies for script elements and event handlers

4. **Add reporting:**
   ```
   report-uri /csp-violation-report-endpoint/;
   report-to csp-endpoint;
   ```

## Server-Side CSP (Recommended for Production)

While the meta tag works, HTTP headers are more secure and flexible:

### For Nginx:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;
```

### For Apache:

```apache
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
```

### For Netlify (\_headers file):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
```

### For Vercel (vercel.json):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        }
      ]
    }
  ]
}
```

## Testing CSP

### Browser DevTools

Open browser console and look for CSP violation warnings:

```
Refused to load the script 'https://example.com/malicious.js' because it violates the following Content Security Policy directive: "script-src 'self'".
```

### CSP Evaluator

Use Google's CSP Evaluator to analyze your policy:
https://csp-evaluator.withgoogle.com/

### Report-Only Mode

Test CSP without blocking by using `Content-Security-Policy-Report-Only` header:

```html
<meta http-equiv="Content-Security-Policy-Report-Only" content="..." />
```

## Compatibility

CSP is supported by all modern browsers:

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support

Legacy browsers (IE11) have partial support but will ignore unsupported directives.

## Related Security Headers

Consider adding these additional security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Maintenance

When adding new features:

1. Test with CSP enabled locally
2. Check browser console for violations
3. Update CSP directives if needed
4. Document any required changes

## Resources

- [MDN CSP Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Quick Reference](https://content-security-policy.com/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
