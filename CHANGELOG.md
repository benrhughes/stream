# Changelog

## 0.3.0

### Settings panel
- Renamed "Velocity" menu to "Settings" with collapsible sections: Add feeds, Display, Velocity
- Added **text size** control (small, default, large)
- Added **fade intensity** control (none, subtle, full)
- Added **highlight colour** picker with four Nord palette options (Frost, Yellow, Green, Berry)
- All display preferences persist to localStorage and apply on load
- Section separators for visual clarity

### Accessibility
- Darkened yellow, green, and berry accent colours on light theme for WCAG AA contrast
- Added `aria-pressed` to all category filter buttons
- Added visible `focus-visible` outline on ConnectScreen form inputs
- Added `<main>` landmark wrapping page content
- Focus trapping in ReadingView and KeyboardHelp dialogs
- Scoped `kbd` styles to avoid global leak

### Security
- HTML sanitiser now strips `javascript:` protocol from `href`, `src`, and `action` attributes

### Performance
- Article body images now use `loading="lazy"`

### Code quality
- Renamed VelocitySettings to Settings (component, files, interface)
- Extracted shared `displayPrefs.ts` module (removes duplication between App and Settings)
- Removed unused `articleTitle` prop from UndoToast
- Fade intensity now driven by `--fade-max` CSS custom property instead of hardcoded value

## 0.2.0

### Features
- Skip login screen when credentials are already saved
- Use "stream" language throughout UI instead of "river"
- Saved items display at full opacity in the saved view (no velocity fading)

### Fixes
- Empty body on GET requests no longer causes 502 in Netlify proxy (Node.js 18+)
- Explicit Netlify build base to override UI setting
- Feedbin adapter routes all requests through proxy
- README credentials privacy note; corrected CORS claim

## 0.1.0

Initial release: velocity-based RSS reader with FreshRSS and Feedbin support.
