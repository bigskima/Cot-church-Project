# White Screen Investigation Findings

## Confirmed root causes

1. **Missing `SafeAreaProvider` at the application root.** Multiple logged-in and logged-out routes call `useSafeAreaInsets()`. Without `SafeAreaProvider`, `react-native-safe-area-context` can throw during render before a screen paints, which presents as a blank/white application surface in production builds.
2. **Remote branding was blocking the entire application shell.** `app/_layout.tsx` returned `null` until `fetchPlatformBranding()` finished. A slow, stalled, misconfigured, or CORS-blocked branding request could therefore leave both authenticated and unauthenticated users with no rendered React UI.
3. **No root error boundary existed.** An uncaught route/render error could fall through to a blank production screen instead of a recoverable user-facing state.
4. **The mobile API client contained a hardcoded Supabase Functions URL fallback.** This hid missing deployment configuration and coupled the client bundle to a specific project. The backend shared config is already environment-driven and should remain that way.
5. **API requests had no default timeout.** Requests made outside `useResource` could remain pending for too long and make bootstrap/action flows appear frozen.

## Fix direction

- Wrap the app in `SafeAreaProvider`.
- Never block the React tree on remote branding/network I/O.
- Keep the native splash offline-safe and dismiss it once the app shell mounts.
- Add a root Expo Router error boundary and a not-found screen.
- Require `EXPO_PUBLIC_API_URL` at deployment time instead of shipping a hardcoded project fallback.
- Give API calls a bounded timeout while preserving caller cancellation.
- Keep branding resilient through bundled/default branding when the branding endpoint is unavailable.

These fixes address the shared failure path affecting logged-in and logged-out screens. Feature-level screens must still be tested individually after the shell is stable.
