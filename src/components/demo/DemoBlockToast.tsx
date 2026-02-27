import { useDemo } from "@/contexts/DemoContext";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export function useDemoBlock() {
  const { isDemo } = useDemo();
  const { toast } = useToast();

  const checkDemo = useCallback((actionName?: string) => {
    if (!isDemo) return false;
    toast({
      title: "Демо-режим",
      description: actionName
        ? `${actionName} — доступно только в приобретённой версии`
        : "Сохранение изменений доступно только в приобретённой версии",
      variant: "destructive",
    });
    return true;
  }, [isDemo, toast]);

  return { isDemo, checkDemo };
}

export default useDemoBlock;