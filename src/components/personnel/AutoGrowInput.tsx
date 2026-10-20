import { useLayoutEffect, useRef } from "react";

interface AutoGrowInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function AutoGrowInput({ value, onChange, placeholder, className = "", disabled }: AutoGrowInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
      className={`block min-h-8 py-1.5 px-2 -mx-2 w-[calc(100%+1rem)] resize-none overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent bg-transparent text-sm font-medium text-foreground leading-5 placeholder:text-muted-foreground outline-none transition-colors hover:bg-secondary/40 hover:border-border focus:bg-secondary/50 focus:ring-1 focus:ring-mine-cyan/50 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-transparent ${className}`}
    />
  );
}
