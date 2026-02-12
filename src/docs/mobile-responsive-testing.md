# Mobile Responsive Testing Guide

**Purpose:** Step-by-step guide for testing and fixing mobile responsiveness (lesson 5.3).  
**Audience:** Developers testing and fixing responsive design issues.

---

## Overview

This guide helps you systematically test your app across different screen sizes and fix responsive issues using Tailwind breakpoints and Cursor AI.

**Key breakpoints:**
- **Base (0px+)** — Mobile phones (iPhone)
- **sm: (640px+)** — Large phones (iPhone Plus/Pro Max)
- **md: (768px+)** — Tablets (iPad portrait)
- **lg: (1024px+)** — Tablets + laptops (iPad landscape, MacBook)
- **xl: (1280px+)** — Laptops + desktops (MacBook)
- **2xl: (1536px+)** — Large desktops (iMac)

**For most B2B SaaS:** Focus on Base, `md:`, and `xl:` breakpoints.

---

## Step 1: Install Responsive Viewer

1. Open Chrome and go to the [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Responsive Viewer"
3. Click "Add to Chrome"
4. Click "Add extension" when prompted
5. Pin the extension to your toolbar for easy access

---

## Step 2: Configure Test Devices

1. Click the Responsive Viewer icon
2. Set up these devices to cover critical breakpoints:

| Device | Width | Tests |
|--------|-------|-------|
| **iPhone** | 390px | Mobile phones (base styles) |
| **iPad** | 820px | Tablets (md: breakpoint) |
| **MacBook** | 1440px | Laptops/desktops (xl: breakpoint) |

These three devices cover the breakpoints you'll use most often.

---

## Step 3: Pages to Test

Test these pages systematically:

### 3.1 Public Pages

1. **Homepage (`/`)**
   - Hero section with headline and CTA button
   - Problem & Audience section with cards
   - Early Access form section
   - **Why important:** Main entry point, has form, hero content

2. **Sign In (`/sign-in`)**
   - Clerk sign-in form
   - **Why important:** Critical user flow, form elements

3. **Sign Up (`/sign-up`)**
   - Clerk sign-up form
   - **Why important:** Critical user flow, form elements

### 3.2 Authenticated Pages

4. **Onboarding (`/onboarding`)**
   - Multi-step onboarding flow
   - **Why important:** First-time user experience, forms

5. **Workspace (`/workspace`)**
   - Main workspace with tabs (Assignments, Tasks, Coming Soon)
   - Case cards and task lists
   - Forms (add task, feature suggestions)
   - **Why important:** Core app functionality, complex layout

### 3.3 Components Across Pages

6. **Header Navigation** (appears on all pages)
   - Sign In/Sign Up buttons (signed out)
   - User button, Feedback trigger, Language toggle (signed in)
   - **Why important:** Navigation must work on all screen sizes

7. **Feedback Modal** (triggered from header)
   - Modal dialog with form
   - Textarea and submit button
   - **Why important:** Form interaction, modal sizing

---

## Step 4: Testing Checklist

For each page, test these elements on **iPhone (390px)**, **iPad (820px)**, and **MacBook (1440px)**:

### Navigation
- [ ] Menu/navigation fits on screen
- [ ] All links accessible without horizontal scrolling
- [ ] Header doesn't wrap awkwardly
- [ ] Language toggle and feedback button visible

### Forms
- [ ] Input fields are full-width on mobile (or appropriately sized)
- [ ] Submit button visible without scrolling
- [ ] Keyboard doesn't cover submit button on mobile
- [ ] Labels and placeholders readable
- [ ] Error messages display correctly

### Cards/Lists
- [ ] Cards stack vertically on mobile (no horizontal overflow)
- [ ] Cards display in grid on tablets/laptops
- [ ] Text doesn't overflow card boundaries
- [ ] Images scale properly

### Modals/Dialogs
- [ ] Modal fits on screen (no cut-off)
- [ ] Close button accessible
- [ ] Content scrollable if needed
- [ ] Form elements usable within modal

### Typography
- [ ] Text readable without zooming (minimum 16px for body)
- [ ] Headlines scale appropriately
- [ ] Line height comfortable for reading

### Buttons
- [ ] Buttons large enough to tap (minimum 44x44px on mobile)
- [ ] Buttons don't overlap or crowd each other
- [ ] Full-width buttons on mobile where appropriate
- [ ] Hover states work (desktop)

### Layout
- [ ] No horizontal scrolling on any device
- [ ] Padding/spacing appropriate for screen size
- [ ] Content doesn't overflow containers
- [ ] Sections stack properly on mobile

---

## Step 5: Document Issues

As you test, create a simple list of issues:

**Example issue list:**
```
iPhone (390px):
- Submit button cut off on early access form
- Header buttons wrap to second line awkwardly
- Workspace tabs overflow horizontally

iPad (820px):
- Cards display side-by-side but too narrow
- Modal could be wider

MacBook (1440px):
- Everything looks good
```

**Format:**
- Device/screen size
- Page/component
- Specific issue description
- What should happen instead

---

## Step 6: Fix Issues with Cursor AI

Use this prompt template when asking Cursor AI to fix responsive issues:

```
I've tested my app on multiple devices using Responsive Viewer and found responsive issues. Help me fix them.

**Devices I tested:**
- iPhone — 390px
- iPad — 820px
- MacBook — 1440px

**Issues I found:**
[Paste your checklist here with specific issues]

**For each issue, please:**
1. Find the component with the problem
2. Fix it so it works correctly on all the devices I listed
3. Explain what you changed and why

**Important:**
- Make sure buttons are easy to tap on mobile (large enough, minimum 44x44px)
- Text should be readable without zooming on phones (minimum 16px for body)
- Nothing should overflow horizontally (no horizontal scrolling)
- Forms should fit properly on all screen sizes
- Modals should fit on screen without cut-off

After you make the fixes, I'll test them in Responsive Viewer to verify they work.
```

### Effective Prompting Tips

**✅ Do:**
- Describe behavior at different screen sizes: "The cards are stacking vertically on my MacBook. Make them display side-by-side on laptops but keep them stacked on mobile phones."
- Specify device categories: "The submit button is too narrow on my iPhone. Make it full-width on mobile phones, but auto-width on tablets and up."
- Describe the problem clearly: "There's too much padding around the form on my iPhone. Reduce the padding on mobile phones, but keep it larger on laptops."

**❌ Don't:**
- Ask for specific Tailwind classes: "Add md:flex-row to this div"
- Use technical jargon: "Use w-full md:w-auto on the button"
- Be vague: "Make it responsive"

---

## Step 7: Test Fixes

After Cursor AI makes changes:

1. **Refresh Responsive Viewer** — reload your app
2. **Test all devices** — check each screen size you configured
3. **Try interactions** — tap buttons, fill forms, open modals
4. **Update checklist** — mark issues as resolved or note if they need more work

### Iterative Process

Don't expect perfection on the first try:

1. Fix a few issues at a time
2. Test after each batch of fixes
3. Provide clear feedback to the AI about what's working and what isn't
4. Iterate until all issues are resolved

**Example follow-up prompt:**
```
The button is better, but it's still cut off on iPhone. Can you make sure it has enough padding around it on that device?
```

---

## Common Responsive Patterns

### Full-width on mobile, auto-width on desktop
```tsx
className="w-full md:w-auto"
```

### Stack vertically on mobile, side-by-side on tablet+
```tsx
className="flex flex-col md:flex-row"
```

### Smaller padding on mobile, larger on desktop
```tsx
className="p-4 lg:p-8"
```

### Smaller text on mobile, larger on desktop
```tsx
className="text-sm md:text-base lg:text-lg"
```

### Grid: 1 column mobile, 2 tablet, 3 desktop
```tsx
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

### Hide on mobile, show on desktop
```tsx
className="hidden md:block"
```

### Show on mobile, hide on desktop
```tsx
className="block md:hidden"
```

---

## Testing Best Practices

1. **Test real interactions:** Don't just look — tap buttons, fill forms, scroll
2. **Test with keyboard:** On mobile, ensure keyboard doesn't cover inputs
3. **Test modals:** Open modals on each device size
4. **Test orientation:** If possible, test portrait and landscape on tablets
5. **Test with content:** Use realistic content lengths (long text, short text)
6. **Test error states:** Ensure error messages display correctly on all sizes

---

## Troubleshooting

### Horizontal Scrolling
- Check for fixed widths: `w-[500px]` → use `max-w-*` or responsive widths
- Check for negative margins that push content out
- Check for `overflow-x-hidden` on body (can hide issues)

### Text Too Small
- Ensure body text is at least `text-sm` (14px) or `text-base` (16px)
- Use responsive text sizes: `text-sm md:text-base`

### Buttons Too Small
- Minimum 44x44px touch target on mobile
- Use `h-10` or `h-11` for buttons (40-44px)
- Add padding: `px-4 py-2` minimum

### Modal Cut Off
- Use `max-w-*` with responsive values: `max-w-[95vw] md:max-w-md`
- Ensure modal has proper padding: `p-4 md:p-6`
- Check for fixed positioning issues

---

## Next Steps

After completing mobile responsive testing:

**Lesson 5.4:** Webhook Integration
- Connect feedback form to n8n webhook
- Create webhook endpoint to receive processed data
- Test complete bidirectional flow

---

## Reference

- **Tailwind Breakpoints:** [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- **Touch Target Sizes:** [WCAG Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- **Responsive Viewer:** [Chrome Web Store](https://chrome.google.com/webstore)
