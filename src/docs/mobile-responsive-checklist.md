# Mobile Responsive Testing Checklist

**Quick reference checklist** for testing responsive design. Use this alongside `mobile-responsive-testing.md`.

---

## Pages to Test

### Public Pages
- [ ] `/` — Homepage (hero, cards, early access form)
- [ ] `/sign-in` — Sign in form
- [ ] `/sign-up` — Sign up form

### Authenticated Pages
- [ ] `/onboarding` — Onboarding flow
- [ ] `/workspace` — Main workspace (tabs, cards, forms)

### Components
- [ ] Header navigation (all pages)
- [ ] Feedback modal (triggered from header)

---

## Test Each Page on These Devices

### iPhone (390px) — Base styles
- [ ] No horizontal scrolling
- [ ] Navigation accessible
- [ ] Forms fit on screen
- [ ] Submit buttons visible (keyboard doesn't cover)
- [ ] Text readable (minimum 16px)
- [ ] Buttons large enough to tap (44x44px minimum)
- [ ] Cards stack vertically
- [ ] Modals fit without cut-off

### iPad (820px) — md: breakpoint
- [ ] Layout adapts appropriately
- [ ] Cards display in grid if applicable
- [ ] Forms have appropriate width
- [ ] Navigation doesn't wrap awkwardly
- [ ] Modals appropriately sized

### MacBook (1440px) — xl: breakpoint
- [ ] Layout uses available space well
- [ ] Cards display side-by-side where appropriate
- [ ] Forms not too wide
- [ ] Navigation clean and accessible
- [ ] Modals appropriately sized

---

## Common Issues to Check

### Navigation
- [ ] Menu fits on screen
- [ ] All links accessible
- [ ] No awkward wrapping
- [ ] Language toggle and feedback button visible

### Forms
- [ ] Inputs full-width on mobile (or appropriately sized)
- [ ] Submit button visible without scrolling
- [ ] Keyboard doesn't cover submit button
- [ ] Labels and placeholders readable
- [ ] Error messages display correctly

### Cards/Lists
- [ ] Stack vertically on mobile
- [ ] Display in grid on tablet+
- [ ] Text doesn't overflow
- [ ] Images scale properly

### Modals
- [ ] Fit on screen (no cut-off)
- [ ] Close button accessible
- [ ] Content scrollable if needed
- [ ] Form elements usable

### Typography
- [ ] Readable without zooming
- [ ] Headlines scale appropriately
- [ ] Comfortable line height

### Buttons
- [ ] Large enough to tap (44x44px minimum)
- [ ] Don't overlap or crowd
- [ ] Full-width on mobile where appropriate

### Layout
- [ ] No horizontal scrolling
- [ ] Appropriate padding/spacing
- [ ] Content doesn't overflow
- [ ] Sections stack properly on mobile

---

## Issue Documentation Template

```
Device: iPhone (390px)
Page: /workspace
Issue: Submit button cut off, requires scrolling to see
Expected: Button should be visible without scrolling, with proper padding

Device: iPad (820px)
Page: /
Issue: Cards display side-by-side but too narrow
Expected: Cards should be wider or stack vertically

Device: MacBook (1440px)
Page: All
Issue: Everything looks good
```

---

## After Testing

1. Document all issues using the template above
2. Use the prompt template from `mobile-responsive-testing.md` section 6
3. Fix issues iteratively with Cursor AI
4. Test fixes on all devices
5. Mark issues as resolved

---

## Quick Reference: Tailwind Breakpoints

- **Base (0px+)** — Mobile phones
- **sm: (640px+)** — Large phones
- **md: (768px+)** — Tablets
- **lg: (1024px+)** — Tablets + laptops
- **xl: (1280px+)** — Laptops + desktops
- **2xl: (1536px+)** — Large desktops

**Focus on:** Base, `md:`, and `xl:` for most B2B SaaS apps.
