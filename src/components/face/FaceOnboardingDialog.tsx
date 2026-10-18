import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import FaceCapture from "./FaceCapture";

export const FACE_ONBOARDING_KEY = "mc_face_onboarding";

export default function FaceOnboardingDialog() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem(FACE_ONBOARDING_KEY) === "1") {
      if (user.has_face) {
        sessionStorage.removeItem(FACE_ONBOARDING_KEY);
      } else {
        setOpen(true);
      }
    }
    if (!user) setOpen(false);
  }, [user]);

  const finish = () => {
    sessionStorage.removeItem(FACE_ONBOARDING_KEY);
    setOpen(false);
  };

  const save = async (descriptors: number[][], photo: string) => {
    await authApi.faceSave(descriptors, photo);
    await refreshUser();
    toast({ title: "Фото сохранено", description: "Теперь можно входить в систему по лицу" });
    finish();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-mine-cyan/10 flex items-center justify-center mb-1">
            <Icon name="ScanFace" size={24} className="text-mine-cyan" />
          </div>
          <DialogTitle>Добавьте фото для входа по лицу</DialogTitle>
          <DialogDescription>
            Тогда в следующий раз можно будет входить без кода — камера узнает вас по лицу.
          </DialogDescription>
        </DialogHeader>
        <p className="text-xs text-mine-amber">
          Самостоятельно фото добавляется один раз. Изменить или удалить его потом сможет только администратор.
        </p>
        <FaceCapture onCapture={save} />
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={finish}>
          Пропустить — добавлю позже в настройках профиля
        </Button>
      </DialogContent>
    </Dialog>
  );
}
