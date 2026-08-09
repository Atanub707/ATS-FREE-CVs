# Tailor CV — Login Page Design Specification

## 1. Objective

Premium, professional login page with a strict 50/50 split-screen layout:
LEFT = 50% Branding / Product introduction · RIGHT = 50% Login form.
Feels like a modern SaaS product, not a generic authentication page.

## 2. Layout (desktop)

- `grid-template-columns: 1fr 1fr` — both sections exactly 50% of viewport width.
- Left: Tailor CV branding, "Created by Atanu", product message, visual decoration.
- Right: Welcome back · Email · Password · Sign In · Forgot password.

## 3. Left side — branding

- Sophisticated, non-overwhelming branded background (dark navy radial gradients + subtle grid).
- Brand: **Tailor CV** / CREATED BY **Atanu** (script/cursive signature, never larger than the product name).
- Headline: "Build a stronger CV. Get noticed faster." (accent line in blue).
- Description: "AI-powered CV tailoring designed to align your experience with the roles you want."
- Badge: `AI-Powered CV Tailoring`.

## 4. Left side visual effects

- Floating gradient circles, soft blurred shapes, slow-moving grid/dot pattern, gentle light glow.
- Slow, elegant, professional: 6–12s animation durations, staggered delays. No flashy motion.

## 5. Logo / brand

- Rounded "T" tile in the primary blue + wordmark "Tailor CV" + "CREATED BY Atanu" (script).

## 6. Right side — login

- White / very light background, vertically centered, form max width 400–440px.
- "Welcome back" / "Sign in to continue to Tailor CV." · Email address · Password (with 👁 toggle) · Forgot password? · [Sign In →].

## 7. Login button

- Full width, 48–52px height, 10–12px radius, semibold, primary blue.
- Hover: elevation + small upward movement + subtle shadow. Active: slight scale-down.
- Loading: animated spinner ("Signing in...").

## 8. Additional authentication

- "or continue with" divider. Google button only if OAuth exists — never fake authentication.

## 9. Registration

- "Don't have an account? **Create an account**" (primary accent). Toggles the existing register mode (name, email, password, 2 security questions).

## 10. Footer

- "© 2026 Tailor CV · Created by Atanu" — subtle, bottom of both panels.

## 11. Animation system

- Left panel: fade + translateX(-20px); right: fade + translateX(20px). 700–900ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- Logo fades + translateY(10px); content/fields staggered; button fade + translateY(8px).

## 12. Background animation

- CSS-only floating objects, `float 8s ease-in-out infinite`, different delays per object.

## 13. Input interaction

- Focus: primary blue border + soft ring (`0 0 0 4px rgba(primary, 0.10)`), 150–200ms transitions.

## 14. Responsive

- Desktop: 50/50. Tablet: 50/50 where possible. Mobile (<900px): stacked; brand ~40vh, login ~60vh; no horizontal scrolling.

## 15. Accessibility

- Labels, keyboard navigation, visible focus, accessible buttons, password toggle, correct autocomplete, `prefers-reduced-motion: reduce` disables decorative animations.

## 16. Visual principles

- Clean whitespace, professional typography, soft borders, subtle shadows, consistent radius, strong hierarchy, minimal decoration.
- Avoid excessive gradients/glassmorphism/huge shadows/flashy animation/stock imagery/overly colorful UI.

## 17. Brand personality

Professional · Intelligent · Modern · Trustworthy · Minimal · AI-powered · Career-focused.
