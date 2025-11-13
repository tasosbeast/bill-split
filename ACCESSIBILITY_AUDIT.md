# Accessibility Audit - Bill Split Application

**Date:** November 12, 2025  
**Auditor:** AI Assistant  
**Standards Referenced:** WCAG 2.1 Level AA

---

## Executive Summary

The Bill Split application demonstrates **strong foundational accessibility** with excellent keyboard navigation, focus management, and ARIA implementation in core interactive components. The application is largely accessible but has room for improvement in color contrast, form validation feedback, and semantic HTML in some areas.

### Overall Rating: 🟢 Good (B+)

**Strengths:**

- ✅ Excellent modal focus trap implementation
- ✅ Comprehensive ARIA attributes on interactive elements
- ✅ Keyboard navigation support (Tab, Escape, Enter)
- ✅ Focus restoration after modal close
- ✅ Toast notifications with proper aria-live regions

**Areas for Improvement:**

- ⚠️ Some buttons rely on title attribute instead of aria-label
- ⚠️ Form error announcements could be more robust
- ⚠️ Missing skip links for main content
- ⚠️ Some interactive elements may have insufficient color contrast

---

## Detailed Findings

### 1. Keyboard Navigation ✅ EXCELLENT

**Status:** Fully accessible

**Findings:**

- Modal component (`Modal.tsx`) implements comprehensive keyboard trapping
- Tab key cycles through focusable elements within modals
- Shift+Tab for reverse navigation
- Escape key closes modals
- Focus is restored to previously focused element on modal close

**Evidence:**

```tsx
// Modal.tsx - Lines 90-110
const handleKeyDown = useCallback(
  (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    // Tab trap logic with Shift+Tab support
    const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTORS));
    // ... proper circular focus management
  },
  [onClose]
);
```

**Recommendation:** ✅ No changes needed. This is exemplary implementation.

---

### 2. Focus Management ✅ EXCELLENT

**Status:** Fully accessible

**Findings:**

- Focus automatically moves to first input field when modals open
- Previous focus is saved and restored on modal close
- Focus indicators visible (`:focus-visible` CSS)
- Focus trap prevents focus from escaping modals

**Evidence:**

```tsx
// Modal.tsx - Lines 55-68
useEffect(() => {
  previouslyFocusedElementRef.current =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const focusTimer = window.setTimeout(() => {
    focusFirstInput();
  }, 0);

  return () => {
    window.clearTimeout(focusTimer);
    const lastFocused = previouslyFocusedElementRef.current;
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  };
}, [focusFirstInput]);
```

**CSS Evidence:**

```css
/* index.css - Lines 258, 281, 822 */
.list-item:focus-visible {
  outline: 2px solid var(--accent);
}
.friend-list__primary:focus-visible {
  outline: 2px solid var(--accent);
}
.toast__close:focus-visible {
  outline: 2px solid #fff;
}
```

**Recommendation:** ✅ No changes needed.

---

### 3. ARIA Attributes ✅ GOOD

**Status:** Well implemented with minor gaps

**Findings:**

#### ✅ Excellent ARIA Usage:

1. **Modal Component:**

   ```tsx
   <div role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
     <h3 id={titleId}>{title}</h3>
   </div>
   ```

2. **Toast Notifications:**

   ```tsx
   <div
     aria-live="polite"
     aria-relevant="additions removals"
   >
     <div role={KIND_ROLE[toast.kind] ?? "status"}>
   ```

3. **Close Buttons:**

   ```tsx
   <button aria-label="Close modal">
     <span aria-hidden="true">✕</span>
   </button>
   ```

4. **Charts/Visualizations:**

   ```tsx
   <div
     role="img"
     aria-label={`Balance composition: owed to you ${formatEUR(owedToYou)}, you owe ${formatEUR(Math.abs(youOwe))}`}
   >
     <div className={styles.barTrack} aria-hidden="true">
   ```

5. **Friend List Buttons:**
   ```tsx
   <button
     aria-pressed={active}
     onClick={() => onSelect(active ? null : friend.id)}
   >
   ```

#### ⚠️ Minor Issues:

1. **Button Labels:** Some buttons use `title` attribute only

   ```tsx
   // FriendList.tsx - Should also have aria-label
   <button
     title={deleteTitle}
     aria-label={deleteTitle}  // ✅ GOOD - has both
   >
   ```

2. **Form Error Announcements:** Error messages should use `aria-describedby`

   ```tsx
   // AddFriendModal.tsx - Current
   {
     error && <div className="error">{error}</div>;
   }

   // Recommended
   {
     error && (
       <div className="error" id={errorId} role="alert">
         {error}
       </div>
     );
   }
   <input
     aria-describedby={error ? errorId : helperId}
     aria-invalid={!!error}
   />;
   ```

**Recommendations:**

1. ✅ Maintain current excellent ARIA usage in modals and toasts
2. ⚠️ Add `aria-describedby` to form inputs linking to error messages
3. ⚠️ Add `aria-invalid` to form fields when validation fails

---

### 4. Semantic HTML ✅ GOOD

**Status:** Generally good with room for improvement

**Findings:**

#### ✅ Good Usage:

- Proper `<button>` elements for all interactive controls
- `<form>` elements with submit handlers
- Heading hierarchy with `<h3>` in modals
- Proper `<label>` associations with form fields

#### ⚠️ Potential Improvements:

1. **Main Landmark:** Application appears to lack `<main>` landmark

   ```jsx
   // Recommended for App.jsx
   <main id="main-content">{/* Main application content */}</main>
   ```

2. **Skip Link:** No skip-to-content link for keyboard users

   ```jsx
   // Recommended addition to App.jsx or index.html
   <a href="#main-content" className="skip-link">
     Skip to main content
   </a>
   ```

3. **List Markup:** Transaction/Friend lists could use `<ul>` and `<li>`

   ```jsx
   // Current in FriendList.tsx
   <div className="list">
     <div className="list-item">...</div>
   </div>

   // Recommended
   <ul className="list" role="list">
     <li className="list-item" role="listitem">...</li>
   </ul>
   ```

**Recommendations:**

1. ⚠️ Add `<main>` landmark to App.jsx
2. ⚠️ Add skip link for keyboard navigation
3. ⚠️ Consider using semantic `<ul>`/`<li>` for lists (optional - current approach is acceptable)

---

### 5. Color Contrast ⚠️ NEEDS TESTING

**Status:** Requires manual color contrast testing

**Findings:**

- Application uses CSS variables for theming
- Focus indicators appear to use `var(--accent)` color
- "Kicker" text (secondary information) may have reduced contrast
- Button states (hover, disabled) need verification

**Recommendations:**

1. ⚠️ Test all text/background color combinations with contrast checker
2. ⚠️ Ensure minimum 4.5:1 contrast ratio for normal text
3. ⚠️ Ensure minimum 3:1 contrast ratio for large text and UI components
4. ⚠️ Test disabled button states for sufficient contrast (may use lighter colors)

**Testing Tools:**

- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Browser DevTools color picker contrast ratio display
- axe DevTools browser extension

**High Priority Elements to Test:**

- `.kicker` class (secondary text) - Lines 10, 192 in index.css
- `.button` states (default, hover, disabled)
- `.button-danger` states
- Error text color
- Focus indicator color (`var(--accent)`)

---

### 6. Form Accessibility ✅ GOOD

**Status:** Well implemented with minor enhancements needed

**Findings:**

#### ✅ Strengths:

1. **Label Associations:**

   ```tsx
   // AddFriendModal.tsx uses proper labels
   <label htmlFor={nameId}>Name</label>
   <input id={nameId} />
   ```

2. **Required Field Indicators:**

   - HTML5 `required` attribute used
   - Visual indicators present

3. **Form Validation:**
   - Client-side validation before submission
   - Error messages displayed on failure

#### ⚠️ Enhancements Needed:

1. **Error Announcements:**

   ```tsx
   // Current: Error shown visually only
   {
     error && <div className="error">{error}</div>;
   }

   // Recommended: Add role="alert" for screen readers
   {
     error && (
       <div className="error" role="alert">
         {error}
       </div>
     );
   }
   ```

2. **Field Error Associations:**

   ```tsx
   // Recommended pattern
   <input
     aria-describedby={error ? errorId : helperId}
     aria-invalid={!!error}
   />
   ```

3. **Loading States:** Consider `aria-busy` for asynchronous operations

**Recommendations:**

1. ⚠️ Add `role="alert"` to all error message containers
2. ⚠️ Link error messages to inputs with `aria-describedby`
3. ⚠️ Add `aria-invalid` to inputs when validation fails
4. ✅ Maintain current label associations

---

### 7. Screen Reader Announcements ✅ EXCELLENT

**Status:** Comprehensive implementation

**Findings:**

1. **Toast Notifications:**

   ```tsx
   <div aria-live="polite" aria-relevant="additions removals">
     <div role={KIND_ROLE[toast.kind] ?? "status"}>{toast.message}</div>
   </div>
   ```

   - Proper use of `aria-live="polite"` for non-critical announcements
   - Dynamic role based on toast kind (error, success, info)

2. **Visual-Only Content Marked:**

   ```tsx
   <span aria-hidden="true">✕</span>
   ```

   - Decorative icons properly hidden from screen readers

3. **Alternative Text for Charts:**
   ```tsx
   <div
     role="img"
     aria-label="Balance composition: [detailed description]"
   >
   ```

**Recommendations:**

1. ✅ No changes needed for toasts
2. ✅ Continue using `aria-hidden` for decorative content
3. ✅ Maintain descriptive `aria-label` for visualizations

---

### 8. Mobile/Touch Accessibility ✅ GOOD

**Status:** Generally accessible, needs touch target size verification

**Findings:**

- Buttons use standard HTML `<button>` elements (automatically touch-accessible)
- Focus management works on touch devices
- No evidence of hover-only interactions

**Recommendations:**

1. ⚠️ Verify all touch targets meet minimum 44×44px size (WCAG 2.5.5)
2. ⚠️ Test swipe gestures don't interfere with modal dismissal
3. ✅ Maintain current button implementation

---

### 9. Content Structure 🟡 MODERATE

**Status:** Good structure with some gaps

**Findings:**

#### ✅ Strengths:

- Modal titles use proper heading tags (`<h3>`)
- Logical reading order
- Content grouped semantically

#### ⚠️ Gaps:

1. **Missing Landmarks:**

   - No `<main>` landmark
   - No `<nav>` for navigation (if applicable)
   - No `<aside>` for supplementary content (analytics sidebar?)

2. **Heading Hierarchy:**

   - Modal titles are `<h3>` - ensure parent context has `<h1>` and `<h2>`
   - Check that application has proper h1-h6 hierarchy

3. **Skip Navigation:**
   - No skip link to bypass repeated content

**Recommendations:**

1. ⚠️ Audit complete heading hierarchy (h1 → h2 → h3)
2. ⚠️ Add `<main id="main-content">` landmark
3. ⚠️ Add skip link: `<a href="#main-content" class="skip-link">Skip to main content</a>`
4. ⚠️ Consider `<nav>`, `<aside>`, `<section>` where appropriate

---

### 10. Dynamic Content Updates ✅ GOOD

**Status:** Well handled

**Findings:**

- Toast notifications use `aria-live` regions
- Template panel uses `aria-live="polite"`:
  ```tsx
  <div className="stack-md" aria-live="polite">
  ```
- Modal content updates are announced via focus management

**Recommendations:**

1. ✅ Continue using aria-live for dynamic notifications
2. ✅ Maintain current focus management for modal updates

---

## Priority Action Items

### 🔴 High Priority (Immediate)

1. **Add role="alert" to form errors**

   - Files: `AddFriendModal.tsx`, `SplitForm.tsx`, `EditTransactionModal.tsx`
   - Impact: Critical for screen reader users to receive validation feedback
   - Effort: Low (15 minutes)

2. **Test and fix color contrast**
   - Elements: All text, buttons, focus indicators
   - Tool: WebAIM Contrast Checker
   - Impact: WCAG 2.1 Level AA compliance
   - Effort: Medium (2-3 hours testing + fixes)

### 🟡 Medium Priority (This Sprint)

3. **Add semantic landmarks**

   - Add `<main>` to App.jsx
   - Add skip link for keyboard users
   - Impact: Improved navigation for screen reader users
   - Effort: Low (30 minutes)

4. **Enhance form error associations**

   - Add `aria-describedby` linking inputs to error messages
   - Add `aria-invalid` to failed inputs
   - Impact: Better screen reader form experience
   - Effort: Medium (1-2 hours)

5. **Verify touch target sizes**
   - Check all buttons meet 44×44px minimum
   - Impact: Mobile accessibility compliance
   - Effort: Low (30 minutes testing + CSS adjustments)

### 🟢 Low Priority (Future Enhancements)

6. **Convert div lists to semantic lists**

   - Use `<ul>`/`<li>` instead of div.list/div.list-item
   - Impact: Better semantic structure
   - Effort: Medium (1-2 hours + testing)

7. **Audit heading hierarchy**

   - Ensure logical h1 → h2 → h3 progression
   - Impact: Better content structure
   - Effort: Low (30 minutes)

8. **Add loading states**
   - Use `aria-busy="true"` during async operations
   - Impact: Better feedback during delays
   - Effort: Low (30 minutes)

---

## Testing Checklist

### Automated Testing

- [ ] Run axe DevTools accessibility scanner
- [ ] Run WAVE browser extension
- [ ] Run Lighthouse accessibility audit
- [ ] Test with ESLint plugin jsx-a11y

### Manual Testing

- [ ] Keyboard-only navigation through all features
- [ ] Screen reader testing (NVDA, JAWS, or VoiceOver)
- [ ] Color contrast verification
- [ ] Touch target size verification (mobile)
- [ ] Form validation announcement testing

### User Testing

- [ ] Test with actual screen reader users
- [ ] Test with keyboard-only users
- [ ] Test on mobile devices with touch
- [ ] Test with high contrast mode enabled

---

## Code Examples for Fixes

### 1. Form Error Pattern (High Priority)

```tsx
// AddFriendModal.tsx - Recommended implementation
export default function AddFriendModal({
  onClose,
  onCreate,
}: AddFriendModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  const errorId = useMemo(
    () => `add-friend-error-${Math.random().toString(36).slice(2)}`,
    []
  );
  const nameErrorId = useMemo(
    () => `name-error-${Math.random().toString(36).slice(2)}`,
    []
  );
  const emailErrorId = useMemo(
    () => `email-error-${Math.random().toString(36).slice(2)}`,
    []
  );

  return (
    <Modal title="Add Friend" onClose={onClose}>
      {({ firstFieldRef }) => (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error" role="alert" id={errorId}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor={nameId}>Name *</label>
            <input
              id={nameId}
              ref={firstFieldRef}
              value={name}
              onChange={handleNameChange}
              required
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? nameErrorId : undefined}
            />
            {fieldErrors.name && (
              <div className="field-error" id={nameErrorId} role="alert">
                {fieldErrors.name}
              </div>
            )}
          </div>

          <div>
            <label htmlFor={emailId}>Email *</label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={handleEmailChange}
              required
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            />
            {fieldErrors.email && (
              <div className="field-error" id={emailErrorId} role="alert">
                {fieldErrors.email}
              </div>
            )}
          </div>

          <button type="submit">Add Friend</button>
        </form>
      )}
    </Modal>
  );
}
```

### 2. Main Landmark Pattern (Medium Priority)

```jsx
// App.jsx - Add main landmark and skip link
function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header>
        <h1>Bill Split</h1>
      </header>

      <main id="main-content">{/* Main application content */}</main>
    </>
  );
}
```

```css
/* index.css - Skip link styles */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--accent);
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### 3. Semantic List Pattern (Low Priority)

```tsx
// FriendList.tsx - Use semantic list markup
export default function FriendList({
  friends,
  onSelect,
  onRemove,
}: FriendListProps) {
  return (
    <ul className="list" role="list">
      {entries.length === 0 && (
        <li className="kicker">No friends yet. Add one to get started.</li>
      )}

      {entries.map((entry) => (
        <li
          key={entry.friend.id}
          className={`list-item friend-list__item${active ? " active" : ""}`}
          role="listitem"
        >
          {/* Existing button content */}
        </li>
      ))}
    </ul>
  );
}
```

---

## Standards Compliance Summary

### WCAG 2.1 Level AA Compliance

| Criterion                        | Status     | Notes                                                      |
| -------------------------------- | ---------- | ---------------------------------------------------------- |
| **1.1.1 Non-text Content**       | ✅ Pass    | Charts have aria-label, decorative content has aria-hidden |
| **1.3.1 Info and Relationships** | 🟡 Partial | Good semantic HTML, missing some landmarks                 |
| **1.3.2 Meaningful Sequence**    | ✅ Pass    | Logical reading order maintained                           |
| **1.4.3 Contrast (Minimum)**     | ⚠️ Unknown | Requires testing                                           |
| **2.1.1 Keyboard**               | ✅ Pass    | All functionality keyboard accessible                      |
| **2.1.2 No Keyboard Trap**       | ✅ Pass    | Focus trap in modals is intentional and escapable          |
| **2.4.1 Bypass Blocks**          | ❌ Fail    | Missing skip link                                          |
| **2.4.3 Focus Order**            | ✅ Pass    | Logical focus order                                        |
| **2.4.7 Focus Visible**          | ✅ Pass    | Focus indicators present                                   |
| **3.2.1 On Focus**               | ✅ Pass    | No unexpected context changes                              |
| **3.2.2 On Input**               | ✅ Pass    | No unexpected context changes                              |
| **3.3.1 Error Identification**   | ✅ Pass    | Errors identified in text                                  |
| **3.3.2 Labels or Instructions** | ✅ Pass    | All inputs have labels                                     |
| **3.3.3 Error Suggestion**       | ✅ Pass    | Validation messages provide guidance                       |
| **4.1.2 Name, Role, Value**      | ✅ Pass    | ARIA attributes properly used                              |
| **4.1.3 Status Messages**        | ✅ Pass    | aria-live regions for toasts                               |

**Overall WCAG 2.1 Level AA Status:** 🟡 **Mostly Compliant** (Pending contrast testing and skip link addition)

---

## Conclusion

The Bill Split application demonstrates **strong accessibility fundamentals** with excellent keyboard navigation, focus management, and ARIA implementation. The Modal component in particular is exemplary and could serve as a reference implementation for other projects.

**Key Strengths:**

1. Comprehensive keyboard navigation with proper tab trapping
2. Excellent focus management and restoration
3. Proper ARIA attributes on interactive elements
4. Screen reader announcements via aria-live regions

**Critical Next Steps:**

1. Add `role="alert"` to form error messages (15 min fix, high impact)
2. Test and fix color contrast issues (2-3 hours)
3. Add semantic landmarks and skip link (30 min fix, moderate impact)

With these improvements, the application will achieve **full WCAG 2.1 Level AA compliance** and provide an excellent experience for all users, including those using assistive technologies.

---

## Resources

### Testing Tools

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluation Tool](https://wave.webaim.org/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)

### Guidelines

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility](https://react.dev/learn/accessibility)

### Screen Readers

- [NVDA (Windows, Free)](https://www.nvaccess.org/)
- [JAWS (Windows, Commercial)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (macOS/iOS, Built-in)](https://www.apple.com/accessibility/voiceover/)

---

**Audit Completed:** November 12, 2025  
**Next Review:** After implementing high priority fixes
