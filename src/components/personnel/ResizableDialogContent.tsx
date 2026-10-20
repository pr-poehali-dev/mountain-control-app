import { useCallback, useEffect, useRef, useState } from "react";
import { DialogContent } from "@/components/ui/dialog";

interface Size {
  width: number;
  height: number | null;
}

interface ResizableDialogContentProps {
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const handles: { dir: Dir; className: string; cursor: string }[] = [
  { dir: "e", className: "top-3 bottom-3 -right-1 w-3", cursor: "ew-resize" },
  { dir: "w", className: "top-3 bottom-3 -left-1 w-3", cursor: "ew-resize" },
  { dir: "s", className: "left-3 right-3 -bottom-1 h-3", cursor: "ns-resize" },
  { dir: "n", className: "left-3 right-3 -top-1 h-3", cursor: "ns-resize" },
  { dir: "se", className: "-right-1 -bottom-1 w-4 h-4", cursor: "nwse-resize" },
  { dir: "nw", className: "-left-1 -top-1 w-4 h-4", cursor: "nwse-resize" },
  { dir: "ne", className: "-right-1 -top-1 w-4 h-4", cursor: "nesw-resize" },
  { dir: "sw", className: "-left-1 -bottom-1 w-4 h-4", cursor: "nesw-resize" },
];

function loadSize(key: string, fallback: number): Size {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { width: fallback, height: null };
}

export default function ResizableDialogContent({
  storageKey,
  defaultWidth = 896,
  minWidth = 560,
  minHeight = 360,
  className = "",
  children,
}: ResizableDialogContentProps) {
  const [size, setSize] = useState<Size>(() => loadSize(storageKey, defaultWidth));
  const [resizing, setResizing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(size));
  }, [size, storageKey]);

  const startResize = useCallback((dir: Dir, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = box.width;
    const startH = box.height;
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 16;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setSize((prev) => {
        let { width, height } = prev;
        if (dir.includes("e")) width = startW + dx * 2;
        if (dir.includes("w")) width = startW - dx * 2;
        if (dir.includes("s")) height = startH + dy * 2;
        if (dir.includes("n")) height = startH - dy * 2;
        width = Math.min(maxW, Math.max(minWidth, width));
        if (height !== null) height = Math.min(maxH, Math.max(minHeight, height));
        return { width, height };
      });
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [minWidth, minHeight]);

  const reset = () => setSize({ width: defaultWidth, height: null });

  return (
    <DialogContent
      ref={boxRef}
      style={{
        width: `min(${size.width}px, calc(100vw - 16px))`,
        maxWidth: "calc(100vw - 16px)",
        height: size.height ? `min(${size.height}px, calc(100vh - 16px))` : undefined,
        maxHeight: size.height ? "calc(100vh - 16px)" : "92vh",
      }}
      className={`flex flex-col p-0 gap-0 overflow-hidden ${resizing ? "select-none" : ""} ${className}`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-4">{children}</div>

      {handles.map((h) => (
        <div
          key={h.dir}
          onPointerDown={(e) => startResize(h.dir, e)}
          onDoubleClick={reset}
          style={{ cursor: h.cursor }}
          className={`absolute z-20 hidden sm:block touch-none ${h.className}`}
        />
      ))}
      <div
        onPointerDown={(e) => startResize("se", e)}
        onDoubleClick={reset}
        title="Потяните, чтобы изменить размер. Двойной щелчок — исходный размер"
        className="absolute bottom-1 right-1 z-20 hidden sm:flex w-4 h-4 items-end justify-end cursor-nwse-resize text-muted-foreground/60 hover:text-mine-cyan"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 1L1 9M9 5L5 9" />
        </svg>
      </div>
    </DialogContent>
  );
}
