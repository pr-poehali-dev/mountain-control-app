import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import Icon from "@/components/ui/icon";
import { personnelApi } from "@/lib/api";

export interface PersonnelOption {
  id: number;
  personal_code: string;
  full_name: string;
  position: string;
  department: string;
  organization: string;
  organization_type: string;
  qr_code: string;
}

interface Props {
  value: PersonnelOption | null;
  onSelect: (p: PersonnelOption | null) => void;
  excludeCodes?: string[];
}

const PersonnelPicker = ({ value, onSelect, excludeCodes = [] }: Props) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PersonnelOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    personnelApi
      .getAll()
      .then((d) => setList(d.personnel || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const available = list.filter((p) => !excludeCodes.includes(p.personal_code));

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex-1 flex items-center justify-between gap-2 h-10 rounded-md border border-input bg-background px-3 text-sm text-left hover:bg-secondary/40"
          >
            {value ? (
              <span className="truncate text-foreground">
                {value.full_name}
                <span className="text-muted-foreground"> · {value.personal_code}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {loading ? "Загружаю список..." : "Выбрать из списка персонала"}
              </span>
            )}
            <Icon name="ChevronsUpDown" size={14} className="text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[300px]" align="start">
          <Command>
            <CommandInput placeholder="ФИО, код, подразделение..." />
            <CommandList className="max-h-72">
              <CommandEmpty>{loading ? "Загрузка..." : "Никого не найдено"}</CommandEmpty>
              <CommandGroup>
                {available.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.full_name} ${p.personal_code} ${p.department || ""} ${p.position || ""}`}
                    onSelect={() => {
                      onSelect(p);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{p.full_name}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {p.personal_code}
                        {p.position ? ` · ${p.position}` : ""}
                        {p.department ? ` · ${p.department}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="p-2 rounded-md text-muted-foreground hover:text-mine-red hover:bg-mine-red/10"
          title="Сбросить выбор"
        >
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
};

export default PersonnelPicker;
