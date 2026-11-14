import { Navigate, Outlet } from "react-router-dom";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";
import { ROUTES } from "./routes";

/** Feed and settings require a started session (a provided user name). */
export function RequireSession() {
  const active = useSessionStore(selectIsActive);
  return active ? <Outlet /> : <Navigate to={ROUTES.onboarding} replace />;
}
