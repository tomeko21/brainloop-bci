import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { ROUTES } from "@/app/routes";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-mono text-7xl font-semibold text-neon">404</p>
        <p className="mt-2 text-muted">This neuron doesn't exist.</p>
        <Link to={ROUTES.onboarding}>
          <Button className="mt-6" variant="secondary">Back to start</Button>
        </Link>
      </div>
    </div>
  );
}
