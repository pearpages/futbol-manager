/**
 * The phone breakpoint lives with the design system, which needs it too (a
 * full-screen dialog's close button); the app re-exports it so its callers and
 * `breakpoints.test.ts` keep one import path.
 */
export { PHONE_QUERY, usePhone } from '@fm/design-system'
