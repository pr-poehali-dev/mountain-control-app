import { Navigate, useParams } from "react-router-dom";
import Checkpoint from "./Checkpoint";
import AppLayout from "@/components/layout/AppLayout";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { useControlPoints } from "@/hooks/use-control-points";

export default function ControlPointPage({ main = false }: { main?: boolean }) {
  const { id } = useParams();
  const { allowedPages } = useAuth();
  const { points, loaded } = useControlPoints();
  const point = main ? points.find((p) => p.is_main) : points.find((p) => String(p.id) === id);

  if (main) return <Checkpoint point={point || null} />;

  if (!point) {
    if (!loaded) {
      return (
        <AppLayout title="Объект контроля">
          <div className="py-20 flex justify-center">
            <Icon name="Loader2" size={28} className="animate-spin text-muted-foreground" />
          </div>
        </AppLayout>
      );
    }
    return <Navigate to="/" replace />;
  }
  if (point.is_main) return <Navigate to="/checkpoint" replace />;
  if (!allowedPages.includes(point.page_key)) return <Navigate to="/" replace />;
  return <Checkpoint key={point.id} point={point} />;
}
