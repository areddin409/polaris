/**
 * Projects View Component
 *
 * The main landing page view for project management. Displays branding,
 * action buttons for creating/importing projects, recent projects list,
 * and a searchable command dialog. Includes keyboard shortcuts for power users.
 *
 * @module features/projects/components/projects-view
 */

"use client";

import { useEffect, useState } from "react";
import { Poppins } from "next/font/google";
import { SparkleIcon } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

import { useCreateProject } from "../hooks/use-projects";
import { ProjectsList } from "./projects-list";
import { ProjectsCommandDialog } from "./projects-command-dialog";
import Image from "next/image";

/**
 * Custom font configuration using Poppins from Google Fonts
 * Applied to the main heading for brand consistency
 */
const font = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Projects View
 *
 * Main dashboard view for project management with keyboard shortcuts,
 * quick actions, and project navigation.
 *
 * @component
 * @returns {JSX.Element} Complete projects dashboard with all features
 *
 * @example
 * // In a page component
 * export default function ProjectsPage() {
 *   return <ProjectsView />;
 * }
 *
 * @remarks
 * Features:
 * - **Branding Header**: Polaris logo and title
 * - **Quick Actions**: New and Import project buttons
 * - **Keyboard Shortcuts**:
 *   - `⌘J` / `Ctrl+J` - Create new project with random name
 *   - `⌘K` / `Ctrl+K` - Open command dialog for project search
 *   - `⌘I` / `Ctrl+I` - Import from GitHub (planned)
 * - **Recent Projects**: Shows up to 6 most recent projects
 * - **Command Dialog**: Searchable project navigation
 *
 * Project Naming:
 * - Automatically generates creative project names using adjective-color-animal pattern
 * - Example: "brave-azure-dolphin", "clever-crimson-eagle"
 * - Ensures unique, memorable names without user input
 *
 * Layout:
 * - Centered, full-screen layout
 * - Responsive design (adjusts for mobile/desktop)
 * - Maximum width constraint for optimal readability
 * - Sidebar background color for subtle distinction
 */
export const ProjectsView = () => {
  const createProject = useCreateProject();
  const [commandDialogOpen, setCommandDialogOpen] = useState(false);

  /**
   * Keyboard Shortcut Handler
   *
   * Sets up global keyboard shortcuts for quick actions.
   * Prevents default browser behavior to avoid conflicts.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();

        // ⌘J: Create new project
        if (key === "j") {
          e.preventDefault(); // Prevent browser's default behavior
          createProject({
            name: uniqueNamesGenerator({
              dictionaries: [adjectives, colors, animals],
              separator: "-",
              length: 3, // Generates names like "brave-blue-tiger"
            }),
          });
        }

        // ⌘K: Toggle command dialog
        if (key === "k") {
          e.preventDefault(); // Prevent browser's default behavior
          setCommandDialogOpen((prev) => !prev);
        }
      }
    };

    // Register global keyboard listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [createProject]);

  return (
    <>
      {/* Searchable command dialog for project navigation */}
      <ProjectsCommandDialog
        open={commandDialogOpen}
        onOpenChange={setCommandDialogOpen}
      />

      <div className="bg-sidebar flex min-h-screen flex-col items-center justify-center p-6 md:p-16">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4">
          {/* Branding Header */}
          <div className="flex w-full items-center justify-between gap-4">
            <div className="group/logo flex w-full items-center gap-2">
              <Image
                src="/logo.svg"
                alt="Polaris"
                className="size-8 md:size-11.5"
                width={45}
                height={45}
              />
              <h1
                className={cn(
                  "text-4xl font-semibold md:text-5xl",
                  font.className
                )}
              >
                Polaris
              </h1>
            </div>
          </div>

          <div className="flex w-full flex-col gap-4">
            {/* Quick Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {/* New Project Button */}
              <Button
                variant={"outline"}
                onClick={() => {
                  createProject({
                    name: uniqueNamesGenerator({
                      dictionaries: [adjectives, colors, animals],
                      separator: "-",
                      length: 3,
                    }),
                  });
                }}
                className="bg-background flex h-full flex-col items-start justify-start gap-6 rounded-none border p-4"
              >
                <div className="flex w-full items-center justify-between">
                  <SparkleIcon className="size-4" />
                  <Kbd className="bg-accent border">⌘J</Kbd>
                </div>
                <div>
                  <span className="text-sm">New</span>
                </div>
              </Button>

              {/* Import Project Button (TODO: implement functionality) */}
              <Button
                variant={"outline"}
                onClick={() => {}}
                className="bg-background flex h-full flex-col items-start justify-start gap-6 rounded-none border p-4"
              >
                <div className="flex w-full items-center justify-between">
                  <FaGithub className="size-4" />
                  <Kbd className="bg-accent border">⌘I</Kbd>
                </div>
                <div>
                  <span className="text-sm">Import</span>
                </div>
              </Button>
            </div>

            {/* Recent Projects List with "View All" action */}
            <ProjectsList onViewAll={() => setCommandDialogOpen(true)} />
          </div>
        </div>
      </div>
    </>
  );
};
