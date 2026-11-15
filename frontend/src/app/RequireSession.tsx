import { Navigate, Outlet } from "react-router-dom";
import { selectIsActive, useSessionStore } from "@/store/sessionStore";
import { ROUTES } from "./routes";

export function RequireSession() {
  const active = useSessionStore(selectIsActive);
  return active ? <Outlet /> : <Navigate to={ROUTES.onboarding} replace />;
}
