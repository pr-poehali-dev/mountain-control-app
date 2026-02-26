import { useState, useCallback, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface SheetData {
  id: number;
  sheet_name: string;
  headers: string[];
  rows_data: (string | number)[][];
  formulas: Record<string, string>;
  merged_cells: string[];
  column_widths: Record<string, number>;
  row_count: number;
  col_count: number;
}

interface Props {
  sheet: SheetData;
  documentId: number;
  onCellUpdate: (rowIdx: number, colIdx: number, value: string) => Promise<void>;
}

function colLetter(idx: number): string {
  let result = "";
  let i = idx;
  while (i >= 0) {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}

function evaluateFormula(
  formula: string,
  allRows: (string | number)[][],
  headers: string[]
): string | number {
  if (!formula.startsWith("=")) return formula;
  const expr = formula.slice(1);

  const sumMatch = expr.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i);
  if (sumMatch) {
    const startCol = sumMatch[1].toUpperCase().charCodeAt(0) - 65;
    const startRow = parseInt(sumMatch[2]) - 2;
    const endCol = sumMatch[3].toUpperCase().charCodeAt(0) - 65;
    const endRow = parseInt(sumMatch[4]) - 2;
    let total = 0;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < allRows.length && c >= 0 && c < (allRows[r]?.length || 0)) {
          const v = parseFloat(String(allRows[r][c]));
          if (!isNaN(v)) total += v;
        }
      }
    }
    return Math.round(total * 100) / 100;
  }

  const avgMatch = expr.match(/^AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i);
  if (avgMatch) {
    const startCol = avgMatch[1].toUpperCase().charCodeAt(0) - 65;
    const startRow = parseInt(avgMatch[2]) - 2;
    const endCol = avgMatch[3].toUpperCase().charCodeAt(0) - 65;
    const endRow = parseInt(avgMatch[4]) - 2;
    let total = 0;
    let count = 0;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < allRows.length && c >= 0 && c < (allRows[r]?.length || 0)) {
          const v = parseFloat(String(allRows[r][c]));
          if (!isNaN(v)) { total += v; count++; }
        }
      }
    }
    return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
  }

  const countMatch = expr.match(/^COUNT\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i);
  if (countMatch) {
    const startCol = countMatch[1].toUpperCase().charCodeAt(0) - 65;
    const startRow = parseInt(countMatch[2]) - 2;
    const endCol = countMatch[3].toUpperCase().charCodeAt(0) - 65;
    const endRow = parseInt(countMatch[4]) - 2;
    let count = 0;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < allRows.length && c >= 0 && c < (allRows[r]?.length || 0)) {
          const v = String(allRows[r][c]).trim();
          if (v !== "") count++;
        }
      }
    }
    return count;
  }

  const cellRef = expr.match(/^([A-Z]+)(\d+)$/i);
  if (cellRef) {
    const c = cellRef[1].toUpperCase().charCodeAt(0) - 65;
    const r = parseInt(cellRef[2]) - 2;
    if (r >= 0 && r < allRows.length && c >= 0 && c < (allRows[r]?.length || 0)) {
      return allRows[r][c];
    }
    return 0;
  }

  return formula;
}

export default function OhsSpreadsheet({ sheet, documentId, onCellUpdate }: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localData, setLocalData] = useState(sheet.rows_data);
  const [localFormulas, setLocalFormulas] = useState(sheet.formulas);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [searchText, setSearchText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalData(sheet.rows_data);
    setLocalFormulas(sheet.formulas);
    setEditingCell(null);
    setSelectedCell(null);
  }, [sheet.id]);

  const getCellFormula = useCallback(
    (rowIdx: number, colIdx: number) => {
      const ref = `${colLetter(colIdx)}${rowIdx + 2}`;
      return localFormulas[ref] || null;
    },
    [localFormulas]
  );

  const getCellDisplay = useCallback(
    (rowIdx: number, colIdx: number) => {
      const formula = getCellFormula(rowIdx, colIdx);
      if (formula) {
        const result = evaluateFormula(formula, localData, sheet.headers);
        return String(result);
      }
      const val = localData[rowIdx]?.[colIdx];
      return val !== undefined && val !== null ? String(val) : "";
    },
    [localData, localFormulas, sheet.headers, getCellFormula]
  );

  const startEdit = (rowIdx: number, colIdx: number) => {
    const formula = getCellFormula(rowIdx, colIdx);
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(formula || String(localData[rowIdx]?.[colIdx] ?? ""));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const finishEdit = async () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const oldVal = String(localData[row]?.[col] ?? "");
    const oldFormula = getCellFormula(row, col);

    if (editValue !== oldVal && editValue !== (oldFormula || oldVal)) {
      const newData = [...localData];
      if (!newData[row]) newData[row] = [];

      if (editValue.startsWith("=")) {
        const ref = `${colLetter(col)}${row + 2}`;
        setLocalFormulas((prev) => ({ ...prev, [ref]: editValue }));
      } else {
        newData[row] = [...newData[row]];
        newData[row][col] = editValue;
        const ref = `${colLetter(col)}${row + 2}`;
        if (localFormulas[ref]) {
          const newF = { ...localFormulas };
          delete newF[ref];
          setLocalFormulas(newF);
        }
      }

      setLocalData(newData);
      await onCellUpdate(row, col, editValue);
    }

    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      finishEdit();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  const formulaCount = Object.keys(localFormulas).length;

  const matchesSearch = useCallback(
    (rowIdx: number) => {
      if (!searchText.trim()) return true;
      const term = searchText.toLowerCase();
      const row = localData[rowIdx];
      if (!row) return false;
      return row.some((cell) => String(cell).toLowerCase().includes(term));
    },
    [searchText, localData]
  );

  const visibleRows = localData
    .map((_, idx) => idx)
    .filter((idx) => matchesSearch(idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Icon name="Rows3" size={14} />
            {localData.length} строк
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="Columns3" size={14} />
            {sheet.headers.length} столбцов
          </span>
          {formulaCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Icon name="Function" size={14} />
              {formulaCount} формул
            </span>
          )}
        </div>

        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск по данным..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 w-56"
          />
        </div>
      </div>

      {selectedCell !== null && (
        <div className="flex items-center gap-3 px-3 py-2 bg-secondary/30 rounded-lg text-sm">
          <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {colLetter(selectedCell.col)}{selectedCell.row + 2}
          </span>
          {getCellFormula(selectedCell.row, selectedCell.col) ? (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Icon name="Function" size={14} />
              <span className="font-mono text-xs">
                {getCellFormula(selectedCell.row, selectedCell.col)}
              </span>
              <span className="text-muted-foreground mx-1">=</span>
              <span className="text-foreground">{getCellDisplay(selectedCell.row, selectedCell.col)}</span>
            </span>
          ) : (
            <span className="text-foreground">{getCellDisplay(selectedCell.row, selectedCell.col)}</span>
          )}
        </div>
      )}

      <div
        ref={tableRef}
        className="overflow-auto rounded-xl border border-border bg-card max-h-[calc(100vh-320px)]"
      >
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary/80 backdrop-blur-sm">
              <th className="px-2 py-2.5 text-center text-[10px] font-medium text-muted-foreground border-r border-border w-10 sticky left-0 bg-secondary/80 z-20">
                #
              </th>
              {sheet.headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-foreground border-r border-border whitespace-nowrap"
                  style={{
                    minWidth: sheet.column_widths[String(idx)]
                      ? `${Math.max(sheet.column_widths[String(idx)] * 8, 80)}px`
                      : "120px",
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground/60 mr-1">
                      {colLetter(idx)}
                    </span>
                    {header}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
              >
                <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground/60 border-r border-border sticky left-0 bg-card font-mono">
                  {rowIdx + 1}
                </td>
                {sheet.headers.map((_, colIdx) => {
                  const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                  const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                  const hasFormula = !!getCellFormula(rowIdx, colIdx);
                  const displayVal = getCellDisplay(rowIdx, colIdx);
                  const isNumber = !isNaN(Number(displayVal)) && displayVal.trim() !== "";

                  return (
                    <td
                      key={colIdx}
                      className={`px-1 py-0 border-r border-border/40 relative cursor-cell ${
                        isSelected ? "ring-2 ring-primary/60 ring-inset bg-primary/5" : ""
                      } ${hasFormula && !isEditing ? "bg-amber-500/5" : ""}`}
                      onClick={() => {
                        setSelectedCell({ row: rowIdx, col: colIdx });
                        if (!isEditing) setEditingCell(null);
                      }}
                      onDoubleClick={() => startEdit(rowIdx, colIdx)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={finishEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full h-full px-2 py-1.5 bg-primary/10 text-foreground text-sm outline-none border-none font-mono"
                        />
                      ) : (
                        <div
                          className={`px-2 py-1.5 truncate text-sm ${
                            isNumber ? "text-right font-mono tabular-nums" : ""
                          } ${hasFormula ? "text-amber-300/90" : "text-foreground"}`}
                          title={hasFormula ? `Formula: ${getCellFormula(rowIdx, colIdx)}` : displayVal}
                        >
                          {displayVal || "\u00A0"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {visibleRows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            {searchText ? "Ничего не найдено" : "Нет данных"}
          </div>
        )}
      </div>

      {formulaCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
          <Icon name="Info" size={14} />
          <span>
            Ячейки с формулами подсвечены. Двойной клик для редактирования. Расчёты выполняются автоматически.
          </span>
        </div>
      )}
    </div>
  );
}
