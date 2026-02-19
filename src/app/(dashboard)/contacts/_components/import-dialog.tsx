"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bulkImportClients,
  type ImportableClient,
} from "@/services/clients.service";

// ============================================================
// TIPOS
// ============================================================

type SystemField =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "document"
  | "person_type"
  | "zip_code"
  | "street"
  | "number"
  | "complement"
  | "neighborhood"
  | "city"
  | "state"
  | "notes"
  | "__ignore__";

interface SystemFieldDef {
  value: SystemField;
  label: string;
  required?: boolean;
}

interface ColumnMapping {
  fileColumn: string;
  systemField: SystemField;
}

interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

interface MappedRow extends ImportableClient {
  _valid: boolean;
  _errors: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

// ============================================================
// CONSTANTES
// ============================================================

const SYSTEM_FIELDS: SystemFieldDef[] = [
  { value: "name", label: "Nome", required: true },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "company", label: "Empresa / Razão Social" },
  { value: "document", label: "CPF / CNPJ" },
  { value: "person_type", label: "Tipo de Pessoa (fisica/juridica)" },
  { value: "zip_code", label: "CEP" },
  { value: "street", label: "Endereço" },
  { value: "number", label: "Número" },
  { value: "complement", label: "Complemento" },
  { value: "neighborhood", label: "Bairro" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "Estado / UF" },
  { value: "notes", label: "Observações" },
  { value: "__ignore__", label: "— Ignorar coluna —" },
];

// Mapeamento automático por nome similar
const AUTO_DETECT: Record<string, SystemField> = {
  nome: "name",
  name: "name",
  "nome completo": "name",
  email: "email",
  "e-mail": "email",
  "e mail": "email",
  telefone: "phone",
  phone: "phone",
  celular: "phone",
  tel: "phone",
  fone: "phone",
  empresa: "company",
  company: "company",
  "razão social": "company",
  "razao social": "company",
  "nome fantasia": "company",
  cnpj: "document",
  cpf: "document",
  documento: "document",
  document: "document",
  "cpf/cnpj": "document",
  tipo: "person_type",
  "tipo pessoa": "person_type",
  "tipo de pessoa": "person_type",
  person_type: "person_type",
  cep: "zip_code",
  zip_code: "zip_code",
  "código postal": "zip_code",
  endereço: "street",
  street: "street",
  rua: "street",
  logradouro: "street",
  número: "number",
  numero: "number",
  number: "number",
  complemento: "complement",
  complement: "complement",
  bairro: "neighborhood",
  neighborhood: "neighborhood",
  cidade: "city",
  city: "city",
  estado: "state",
  state: "state",
  uf: "state",
  "observações": "notes",
  observacoes: "notes",
  notas: "notes",
  notes: "notes",
  obs: "notes",
};

function autoDetect(header: string): SystemField {
  const normalized = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return AUTO_DETECT[normalized] ?? "__ignore__";
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePersonType(value: string): "FISICA" | "JURIDICA" {
  const v = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v.includes("juridica") || v === "j" || v === "pj" || v.includes("cnpj")) {
    return "JURIDICA";
  }
  return "FISICA";
}

// ============================================================
// STEPS UI HELPER
// ============================================================

const STEPS = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Mapeamento" },
  { num: 3, label: "Preview" },
  { num: 4, label: "Importar" },
];

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ── Reset ao fechar ──────────────────────────────────────
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setFileName("");
      setParsed(null);
      setMappings([]);
      setMappedRows([]);
      setImporting(false);
      setProgress(0);
      setResult(null);
    }, 300);
  };

  // ── Leitura do arquivo ───────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      toast.error("Formato inválido. Use .csv ou .xlsx");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });

        if (json.length === 0) {
          toast.error("O arquivo está vazio ou sem dados válidos.");
          return;
        }

        const headers = Object.keys(json[0]);
        const parsed: ParsedFile = { headers, rows: json };
        setParsed(parsed);

        // Auto-mapear
        const autoMappings: ColumnMapping[] = headers.map((h) => ({
          fileColumn: h,
          systemField: autoDetect(h),
        }));
        setMappings(autoMappings);
        setStep(2);
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // ── Mapeamento → Preview ─────────────────────────────────
  const buildMappedRows = () => {
    if (!parsed) return;

    const rows: MappedRow[] = parsed.rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const m of mappings) {
        if (m.systemField !== "__ignore__") {
          const val = (row[m.fileColumn] ?? "").toString().trim();
          if (val) mapped[m.systemField] = val;
        }
      }

      const errors: string[] = [];

      if (!mapped.name) errors.push("Nome obrigatório");
      if (mapped.email && !validateEmail(mapped.email)) {
        errors.push("E-mail inválido");
      }

      const personType = mapped.person_type
        ? normalizePersonType(mapped.person_type)
        : "FISICA";

      return {
        name: mapped.name ?? "",
        email: mapped.email || undefined,
        phone: mapped.phone || undefined,
        company: mapped.company || undefined,
        document: mapped.document || undefined,
        person_type: personType,
        zip_code: mapped.zip_code || undefined,
        street: mapped.street || undefined,
        number: mapped.number || undefined,
        complement: mapped.complement || undefined,
        neighborhood: mapped.neighborhood || undefined,
        city: mapped.city || undefined,
        state: mapped.state || undefined,
        notes: mapped.notes || undefined,
        _valid: errors.length === 0,
        _errors: errors,
      };
    });

    setMappedRows(rows);
    setStep(3);
  };

  // ── Importação ───────────────────────────────────────────
  const handleImport = async () => {
    const validRows = mappedRows.filter((r) => r._valid);
    if (validRows.length === 0) {
      toast.error("Nenhum registro válido para importar.");
      return;
    }

    setImporting(true);
    setProgress(0);
    setStep(4);

    try {
      const importRows: ImportableClient[] = validRows.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ _valid, _errors, ...rest }) => rest
      );

      const res = await bulkImportClients(importRows, setProgress);
      setResult(res);
      setProgress(100);

      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        `${res.imported} contato${res.imported !== 1 ? "s" : ""} importado${res.imported !== 1 ? "s" : ""} com sucesso!`
      );
    } catch {
      toast.error("Erro inesperado durante a importação.");
    } finally {
      setImporting(false);
    }
  };

  const validCount = mappedRows.filter((r) => r._valid).length;
  const errorCount = mappedRows.filter((r) => !r._valid).length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar contatos
          </DialogTitle>
          <DialogDescription>
            Importe contatos em massa a partir de um arquivo .csv ou .xlsx
          </DialogDescription>
        </DialogHeader>

        {/* ── Steps indicator ── */}
        <div className="flex items-center gap-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  step > s.num
                    ? "bg-primary text-primary-foreground"
                    : step === s.num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block",
                  step === s.num
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 mx-1 bg-border min-w-[20px]",
                    step > s.num + 1 ? "bg-primary" : ""
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto py-4">
            <div
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload
                className={cn(
                  "mb-4 h-12 w-12",
                  dragging ? "text-primary" : "text-muted-foreground"
                )}
              />
              <p className="mb-1 text-sm font-semibold text-foreground">
                Arraste e solte seu arquivo aqui
              </p>
              <p className="text-xs text-muted-foreground">
                ou clique para selecionar
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Formatos aceitos: <strong>.csv</strong>, <strong>.xlsx</strong>
              </p>
            </div>

            {/* Template download hint */}
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Dica:</strong> O arquivo deve conter uma linha de cabeçalho
              com os nomes das colunas. Campos suportados: Nome, E-mail,
              Telefone, Empresa, CPF/CNPJ, Endereço, Cidade, Estado, etc.
            </div>
          </div>
        )}

        {/* ── Step 2: Mapeamento ── */}
        {step === 2 && parsed && (
          <div className="flex-1 overflow-y-auto py-2">
            <p className="mb-3 text-sm text-muted-foreground">
              Arquivo: <strong>{fileName}</strong> —{" "}
              <strong>{parsed.rows.length}</strong> registros encontrados.
              Verifique o mapeamento de colunas abaixo.
            </p>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2">Coluna do arquivo</TableHead>
                    <TableHead className="w-1/2">Campo do sistema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m, idx) => (
                    <TableRow key={m.fileColumn}>
                      <TableCell className="font-medium text-sm">
                        {m.fileColumn}
                        {/* Amostra do valor */}
                        {parsed.rows[0]?.[m.fileColumn] && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ex: {parsed.rows[0][m.fileColumn]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.systemField}
                          onValueChange={(val) => {
                            const next = [...mappings];
                            next[idx] = {
                              ...next[idx],
                              systemField: val as SystemField,
                            };
                            setMappings(next);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Aviso: nome obrigatório */}
            {!mappings.some((m) => m.systemField === "name") && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Mapeie pelo menos a coluna <strong>Nome</strong> para continuar.
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 3 && (
          <div className="flex-1 overflow-y-auto py-2">
            {/* Contadores */}
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {validCount}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  válido{validCount !== 1 ? "s" : ""}
                </span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    {errorCount}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    com erro{errorCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Total: {mappedRows.length} registros
              </div>
            </div>

            {/* Preview tabela */}
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRows.slice(0, 10).map((row, i) => (
                      <TableRow
                        key={i}
                        className={
                          row._valid
                            ? ""
                            : "bg-red-50/50 dark:bg-red-900/10"
                        }
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {row.name || (
                            <span className="text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.email || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.company || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.phone || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row._valid ? (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-700 text-xs"
                            >
                              OK
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                              title={row._errors.join(", ")}
                            >
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {mappedRows.length > 10 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Exibindo os primeiros 10 de {mappedRows.length} registros.
              </p>
            )}

            {errorCount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Registros com erro serão <strong>ignorados</strong> na
                  importação. Apenas os {validCount} registros válidos serão
                  inseridos.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Importação / Resultado ── */}
        {step === 4 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-6">
            {importing ? (
              <>
                <div className="text-center space-y-2">
                  <Users className="mx-auto h-12 w-12 text-primary animate-pulse" />
                  <p className="font-semibold text-foreground">
                    Importando contatos...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(progress)}% concluído
                  </p>
                </div>
                <Progress value={progress} className="w-full max-w-sm" />
              </>
            ) : result ? (
              <>
                <div className="text-center space-y-2">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                  <p className="text-lg font-semibold text-foreground">
                    Importação concluída!
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {result.imported}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                      Importado{result.imported !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {result.skipped}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      Ignorado{result.skipped !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {result.errors}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                      Erro{result.errors !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {result.skipped > 0 && (
                  <p className="text-xs text-muted-foreground text-center max-w-sm">
                    Registros ignorados possuem e-mail ou CPF/CNPJ já
                    cadastrado no sistema.
                  </p>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── Footer com navegação ── */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
          {/* Fechar / Voltar */}
          {step === 1 && (
            <Button variant="outline" onClick={handleClose}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={importing}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          )}
          {step === 4 && result && (
            <Button variant="outline" onClick={handleClose}>
              <X className="mr-2 h-4 w-4" />
              Fechar
            </Button>
          )}

          {/* Avançar */}
          {step === 2 && (
            <Button
              onClick={buildMappedRows}
              disabled={!mappings.some((m) => m.systemField === "name")}
            >
              Ver preview
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={() => {
                setStep(4);
                handleImport();
              }}
              disabled={validCount === 0}
            >
              <Users className="mr-2 h-4 w-4" />
              Importar {validCount} contato{validCount !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
