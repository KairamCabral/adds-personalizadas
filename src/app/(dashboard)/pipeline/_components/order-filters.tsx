"use client";

import { useQueryState, parseAsString } from "nuqs";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LABELS, ORDER_TYPES, PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function OrderFilters() {
  const [responsavel, setResponsavel] = useQueryState("responsavel", parseAsString);
  const [prioridade, setPrioridade] = useQueryState("prioridade", parseAsString);
  const [tipo, setTipo] = useQueryState("tipo", parseAsString);
  const [etiqueta, setEtiqueta] = useQueryState("etiqueta", parseAsString);
  const [busca, setBusca] = useQueryState("busca", parseAsString);
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, full_name")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("is_active", true as any)
      .order("full_name")
      .then(({ data }) => setProfiles((data ?? []) as { id: string; full_name: string }[]));
  }, []);

  const activeCount = [
    !!responsavel,
    !!prioridade,
    !!tipo,
    !!etiqueta,
    !!busca,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setResponsavel(null);
    setPrioridade(null);
    setTipo(null);
    setEtiqueta(null);
    setBusca(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-3 text-xs font-medium",
            activeCount > 0 && "border-primary/30 bg-primary/5 text-primary"
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Filtros</span>
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearFilters}
              >
                <X className="mr-1 h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Use a busca na barra acima para filtrar por cliente. Os filtros abaixo refinam os resultados.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Responsável
            </label>
            <Select
              value={responsavel ?? "__all__"}
              onValueChange={(v) =>
                setResponsavel(v === "__all__" ? null : v)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  Todos
                </SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Prioridade
            </label>
            <Select
              value={prioridade ?? "__all__"}
              onValueChange={(v) =>
                setPrioridade(v === "__all__" ? null : v)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  Todas
                </SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.key} value={p.key} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo
            </label>
            <Select
              value={tipo ?? "__all__"}
              onValueChange={(v) => setTipo(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  Todos
                </SelectItem>
                {ORDER_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Etiqueta
            </label>
            <Select
              value={etiqueta ?? "__all__"}
              onValueChange={(v) =>
                setEtiqueta(v === "__all__" ? null : v)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">
                  Todas
                </SelectItem>
                {LABELS.map((l) => (
                  <SelectItem key={l.key} value={l.key} className="text-xs">
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
