import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import FaceCapture from "./FaceCapture";

export default function FaceEnroll() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const hasFace = !!user?.has_face;
  const isAdmin = user?.role === "admin";
  const canSelfEnroll = isAdmin || (user?.face_can_self_enroll ?? !hasFace);
  const isDemo = localStorage.getItem("mc_demo") === "true";

  const save = async (descriptors: number[][], photo: string) => {
    await authApi.faceSave(descriptors, photo);
    await refreshUser();
    toast({ title: "Фото сохранено", description: "Теперь можно входить в систему по лицу" });
  };

  const remove = async () => {
    setBusy(true);
    try {
      await authApi.faceDelete();
      await refreshUser();
      toast({ title: "Вход по лицу отключён" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-3">
        {hasFace && user?.face_photo_url ? (
          <img src={user.face_photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-mine-cyan/10 flex items-center justify-center">
            <Icon name="ScanFace" size={22} className="text-mine-cyan" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Вход по лицу</p>
          <p className={`text-xs ${hasFace ? "text-mine-green" : "text-muted-foreground"}`}>
            {hasFace ? "Фото добавлено — вход по лицу включён" : "Добавьте фото, чтобы входить через камеру"}
          </p>
        </div>
      </div>

      {isDemo ? (
        <p className="text-xs text-muted-foreground">Недоступно в демо-режиме</p>
      ) : canSelfEnroll ? (
        <>
          {!isAdmin && (
            <p className="text-xs text-mine-amber">
              Фото можно добавить самостоятельно только один раз. Изменить или удалить его потом сможет только администратор.
            </p>
          )}
          <FaceCapture
            onCapture={save}
            busy={busy}
            cameraLabel={hasFace ? "Переснять" : "Снять с камеры"}
            extraButtons={
              isAdmin && hasFace ? (
                <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-mine-red" onClick={remove} disabled={busy}>
                  <Icon name="Trash2" size={14} />
                  Удалить
                </Button>
              ) : null
            }
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {hasFace
            ? "Чтобы заменить или удалить фото, обратитесь к администратору."
            : "Фото уже добавлялось ранее. Чтобы добавить новое, обратитесь к администратору."}
        </p>
      )}
    </div>
  );
}
