import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FaceCapture from "@/components/face/FaceCapture";

export interface FaceUser {
  id: number;
  full_name: string;
  has_face?: boolean;
  face_photo_url?: string;
}

interface Props {
  user: FaceUser | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function UserFaceDialog({ user, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<{ has: boolean; url: string } | null>(null);

  const has = current ? current.has : !!user?.has_face;
  const url = current ? current.url : user?.face_photo_url || "";

  const close = () => {
    setCurrent(null);
    setError("");
    onClose();
  };

  const save = async (descriptors: number[][], photo: string) => {
    if (!user) return;
    const res = await authApi.faceSave(descriptors, photo, user.id);
    setCurrent({ has: true, url: res.face_photo_url || "" });
    toast({ title: "Фото сохранено", description: `${user.full_name} может входить по лицу` });
    onChanged();
  };

  const remove = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await authApi.faceDelete(user.id);
      setCurrent({ has: false, url: "" });
      toast({ title: "Фото удалено", description: "Вход по лицу для сотрудника отключён" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Фото для входа по лицу</DialogTitle>
          <DialogDescription>{user?.full_name}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          {has && url ? (
            <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center">
              <Icon name={has ? "ScanFace" : "UserX"} size={30} className="text-muted-foreground" />
            </div>
          )}
          <div className="text-sm">
            {has ? (
              <span className="text-mine-green flex items-center gap-1.5">
                <Icon name="CheckCircle2" size={14} /> Вход по лицу включён
              </span>
            ) : (
              <span className="text-muted-foreground">Фото не добавлено</span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-2 rounded-md bg-mine-red/10 border border-mine-red/20 text-mine-red text-xs">{error}</div>
        )}

        <FaceCapture
          onCapture={save}
          busy={busy}
          cameraLabel={has ? "Переснять" : "Снять с камеры"}
          extraButtons={
            has ? (
              <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-mine-red" onClick={remove} disabled={busy}>
                <Icon name="Trash2" size={14} />
                Удалить фото
              </Button>
            ) : null
          }
        />
      </DialogContent>
    </Dialog>
  );
}
