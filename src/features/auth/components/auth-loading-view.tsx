/**
 * Auth Loading View Component
 *
 * A full-screen loading indicator displayed during authentication state checks.
 * Shows a spinner while waiting for authentication to complete.
 *
 * @module features/auth/components/auth-loading-view
 */

import { Spinner } from "@/components/ui/spinner";

/**
 * Auth Loading View
 *
 * Displays a centered spinner during authentication loading states.
 * Used while checking authentication status or waiting for user session.
 *
 * @component
 * @returns {JSX.Element} Full-screen centered loading spinner
 *
 * @example
 * // In an authentication wrapper
 * function AuthenticatedRoute({ children }) {
 *   const { isLoaded, userId } = useAuth();
 *
 *   if (!isLoaded) {
 *     return <AuthLoadingView />;
 *   }
 *
 *   if (!userId) {
 *     return <UnauthenticatedView />;
 *   }
 *
 *   return <>{children}</>;
 * }
 *
 * @example
 * // In a protected layout
 * export default function ProtectedLayout({ children }) {
 *   const { isLoaded } = useAuth();
 *
 *   if (!isLoaded) return <AuthLoadingView />;
 *
 *   return <Layout>{children}</Layout>;
 * }
 *
 * @remarks
 * Features:
 * - Full-screen centered layout
 * - Themed spinner (uses ring color)
 * - Minimal UI to avoid distraction
 * - Matches application background color
 *
 * Use Cases:
 * - Initial authentication check on page load
 * - Waiting for Clerk session to load
 * - Token validation in progress
 * - SSR/hydration authentication state synchronization
 */
export const AuthLoadingView = () => {
  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <Spinner className="text-ring size-6" />
    </div>
  );
};
