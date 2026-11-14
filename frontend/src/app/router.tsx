import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import OnboardingPage from "@/pages/OnboardingPage";
import FeedPage from "@/pages/FeedPage";
import SettingsPage from "@/pages/SettingsPage";
import AdminPage from "@/pages/AdminPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { RequireSession } from "./RequireSession";
import { ROUTES } from "./routes";

export const router = createBrowserRouter([
  { path: ROUTES.onboarding, element: <OnboardingPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.feed, element: <FeedPage /> },
          { path: ROUTES.settings, element: <SettingsPage /> },
        ],
      },
    ],
  },
  // Admin panel – accessed directly via URL (/admin) or via the button in Settings
  { path: ROUTES.admin, element: <AdminPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
