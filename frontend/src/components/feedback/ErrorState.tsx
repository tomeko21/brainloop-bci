import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle className="size-8 text-danger" />
      <p className="max-w-xs text-sm text-muted">{message ?? "Something went wrong."}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
