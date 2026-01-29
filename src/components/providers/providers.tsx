"use client";

import { ClerkProvider, useAuth, UserButton } from "@clerk/nextjs";
import {
  Authenticated,
  AuthLoading,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "./theme-provider";
import { UnauthenticatedView } from "@/features/auth/components/unauthenticated-view";
import { AuthLoadingView } from "@/features/auth/components/auth-loading-view";

/**
 * Initialize the Convex React client with the deployment URL.
 * This client handles real-time data synchronization between your app and the Convex backend.
 *
 * @see https://docs.convex.dev/client/react
 */
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Root Providers Component
 *
 * Wraps the entire application with essential providers in the correct order:
 * 1. ClerkProvider - Manages authentication state and session management
 * 2. ConvexProviderWithClerk - Integrates Convex real-time backend with Clerk auth
 * 3. ThemeProvider - Handles dark/light theme switching with next-themes
 *
 * @component
 * @example
 * ```tsx
 * // In your root layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <Providers>{children}</Providers>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render within the providers
 * @returns {JSX.Element} The provider tree with authentication-based rendering
 *
 * @remarks
 * Authentication States:
 * - `<Authenticated>` - Renders when user is signed in (shows UserButton + children)
 * - `<Unauthenticated>` - Renders when user is signed out (shows SignIn/SignUp buttons)
 * - `<AuthLoading>` - Renders during auth state initialization
 *
 * Theme Configuration:
 * - Uses 'class' strategy for Tailwind dark mode
 * - Defaults to dark theme
 * - System theme detection enabled
 * - Transitions disabled for instant theme switching
 *
 * @see {@link https://docs.convex.dev/auth/clerk Convex + Clerk Integration}
 * @see {@link https://clerk.com/docs/components/overview Clerk Components}
 */
export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Authenticated>
            <UserButton />
            {children}
          </Authenticated>
          <Unauthenticated>
            <UnauthenticatedView />
          </Unauthenticated>
          <AuthLoading>
            <AuthLoadingView />
          </AuthLoading>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
};
