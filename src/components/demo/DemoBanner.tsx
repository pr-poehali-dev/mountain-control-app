import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const DemoBanner = () => {
  const { isDemo, demoName, exitDemo } = useDemo();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo) return null;

  const handleExit = () => {
    exitDemo();
    navigate("/login");
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-mine-amber via-mine-amber to-yellow-500 text-black px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="Eye" size={18} className="shrink-0" />
          <span className="text-sm font-semibold truncate">
            ДЕМО-РЕЖИМ{demoName ? `: ${demoName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs hidden sm:block opacity-80">
            Сохранение данных недоступно. Приобретите лицензию для полной работы.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-black/10 border-black/20 hover:bg-black/20 text-black"
            onClick={handleExit}
          >
            <Icon name="LogOut" size={14} className="mr-1" />
            Выйти
          </Button>
        </div>
      </div>

      {!dismissed && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-mine-amber/20 flex items-center justify-center">
                <Icon name="Eye" size={24} className="text-mine-amber" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Демо-режим</h3>
                <p className="text-sm text-muted-foreground">Ознакомительный доступ к системе</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-foreground/80">
              <div className="flex items-start gap-2">
                <Icon name="Check" size={16} className="text-mine-green shrink-0 mt-0.5" />
                <span>Все разделы и функции системы доступны для просмотра</span>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="Check" size={16} className="text-mine-green shrink-0 mt-0.5" />
                <span>Кнопки и формы активны — можно попробовать весь функционал</span>
              </div>
              <div className="flex items-start gap-2">
                <Icon name="Check" size={16} className="text-mine-green shrink-0 mt-0.5" />
                <span>Загружены образцы данных работников</span>
              </div>
              <div className="flex items-start gap-2 text-mine-amber">
                <Icon name="AlertTriangle" size={16} className="shrink-0 mt-0.5" />
                <span className="font-medium">Сохранение изменений доступно только в приобретённой версии</span>
              </div>
            </div>

            <Button
              className="w-full bg-mine-amber text-black hover:bg-mine-amber/90 font-semibold"
              onClick={() => setDismissed(true)}
            >
              <Icon name="Rocket" size={16} className="mr-2" />
              Начать знакомство
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default DemoBanner;