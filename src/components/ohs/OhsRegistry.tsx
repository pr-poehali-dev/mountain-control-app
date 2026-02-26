import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ohsApi } from "@/lib/api";
import OhsSpreadsheet from "./OhsSpreadsheet";

interface Document {
  id: number;
  title: string;
  category: string;
  file_name: string;
  created_at: string;
  sheets_count: number;
  total_rows: number;
}

interface SheetData {
  id: number;
  sheet_name: string;
  sheet_index: number;
  headers: string[];
  rows_data: (string | number)[][];
  formulas: Record<string, string>;
  merged_cells: string[];
  column_widths: Record<string, number>;
  row_count: number;
  col_count: number;
}

interface DocumentDetail {
  id: number;
  title: string;
  file_name: string;
  sheets_data: SheetData[];
}

export default function OhsRegistry() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocumentDetail | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    setLoading(true);
    const data = await ohsApi.getDocuments({ category: "employee_registry" });
    setDocuments((data.documents || []).filter((d: Document) => d.title !== "[удалён]"));
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Выберите файл", variant: "destructive" });
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Поддерживаются только .xlsx и .xls файлы", variant: "destructive" });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    });

    const result = await ohsApi.upload({
      file: base64,
      file_name: file.name,
      title: file.name.replace(/\.(xlsx|xls)$/i, ""),
      category: "employee_registry",
    });

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";

    if (result.success) {
      toast({ title: result.message || "Документ загружен" });
      fetchDocuments();
      openDocument(result.document_id);
    } else {
      toast({ title: result.error || "Ошибка загрузки", variant: "destructive" });
    }
  };

  const openDocument = async (id: number) => {
    const data = await ohsApi.getDocument(id);
    setActiveDoc(data);
    setActiveSheet(0);
  };

  const handleDeleteDoc = async (id: number) => {
    await ohsApi.deleteDocument(id);
    toast({ title: "Документ удалён" });
    setActiveDoc(null);
    fetchDocuments();
  };

  if (activeDoc && activeDoc.sheets_data?.length > 0) {
    const sheet = activeDoc.sheets_data[activeSheet];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveDoc(null)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ArrowLeft" size={16} />
              <span className="text-sm">К списку</span>
            </button>
            <div className="w-px h-5 bg-border" />
            <div>
              <h3 className="text-base font-semibold text-foreground">{activeDoc.title}</h3>
              <p className="text-xs text-muted-foreground">{activeDoc.file_name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteDoc(activeDoc.id)}
            className="text-destructive hover:text-destructive"
          >
            <Icon name="Trash2" size={16} />
          </Button>
        </div>

        {activeDoc.sheets_data.length > 1 && (
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 overflow-x-auto">
            {activeDoc.sheets_data.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveSheet(idx)}
                className={`px-4 py-2 rounded-md text-sm whitespace-nowrap transition-all ${
                  activeSheet === idx
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {s.sheet_name}
              </button>
            ))}
          </div>
        )}

        <OhsSpreadsheet
          sheet={sheet}
          documentId={activeDoc.id}
          onCellUpdate={async (rowIdx, colIdx, value) => {
            await ohsApi.updateCell({
              document_id: activeDoc.id,
              sheet_id: sheet.id,
              row_index: rowIdx,
              col_index: colIdx,
              value,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-card/50">
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Icon name="FileSpreadsheet" size={32} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Загрузить Excel-файл</h3>
            <p className="text-sm text-muted-foreground">
              Файл будет изучен, все листы, данные и формулы сохранятся в электронном блоке
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="ohs-file-upload"
            />
            <label
              htmlFor="ohs-file-upload"
              className="cursor-pointer px-5 py-2.5 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-sm font-medium transition-colors"
            >
              Выбрать файл
            </label>
            <Button onClick={handleUpload} disabled={uploading} className="gap-2">
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={16} />
                  Загрузить
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="FolderOpen" size={48} className="mx-auto mb-3 opacity-30" />
          <p>Документов пока нет. Загрузите первый Excel-файл.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openDocument(doc.id)}
              className="text-left p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Icon name="FileSpreadsheet" size={22} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{doc.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.file_name}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="Layers" size={12} />
                      {doc.sheets_count} {doc.sheets_count === 1 ? "лист" : "листов"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="Rows3" size={12} />
                      {doc.total_rows} строк
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                    {new Date(doc.created_at).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
