/**
 * Unauthenticated View Component
 *
 * A full-screen view displayed to users who are not authenticated or
 * unauthorized to access a resource. Provides a clear message and
 * sign-in button to proceed.
 *
 * @module features/auth/components/unauthenticated-view
 */

import { ShieldAlertIcon } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/**
 * Unauthenticated View
 *
 * Displays an unauthorized access message with a sign-in button.
 * Shown when users attempt to access protected resources without authentication.
 *
 * @component
 * @returns {JSX.Element} Full-screen unauthorized message with sign-in action
 *
 * @example
 * // In a protected route or component
 * function ProtectedPage() {
 *   const { userId } = useAuth();
 *
 *   if (!userId) {
 *     return <UnauthenticatedView />;
 *   }
 *
 *   return <ProtectedContent />;
 * }
 *
 * @remarks
 * Features:
 * - Full-screen centered layout
 * - Shield alert icon for visual clarity
 * - Clear "Unauthorized Access" message
 * - Clerk SignInButton integration
 * - Responsive card-based design
 *
 * Use Cases:
 * - Protected routes without authentication
 * - Insufficient permissions for resource access
 * - Session expiration requiring re-authentication
 * - Authorization failures
 */
export const UnauthenticatedView = () => {
  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <div className="bg-muted w-full max-w-lg">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <ShieldAlertIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Unauthorized Access</ItemTitle>
            <ItemDescription>
              You are not authorized to access this resource.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <SignInButton>
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </ItemActions>
        </Item>
      </div>
    </div>
  );
};
