import { Power, Radar } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Card } from "@/components/ui";
import { useSessionLifecycle } from "@/features/session/useSessionLifecycle";
import { useRecordingStore } from "@/store/recordingStore";
import { ROUTES } from "@/app/routes";

export function SessionActions() {
  const { finish, finishing, error } = useSessionLifecycle();
  const recording = useRecordingStore((s) => s.status === "recording");

  return (
    <Card className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">End session</p>
        <p className="text-xs text-muted">
          {recording ? "Stops the recording and saves the video + all CSVs to data/sessions/ (and appends to data/dataset/)." : "Saves this session's CSVs to data/sessions/ and appends to data/dataset/."}
        </p>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Link to={ROUTES.admin}>
          <Button variant="secondary"><Radar className="size-4" /> Admin panel</Button>
        </Link>
        <Button variant="danger" loading={finishing} onClick={() => void finish()}>
          <Power className="size-4" /> End
        </Button>
      </div>
    </Card>
  );
}
