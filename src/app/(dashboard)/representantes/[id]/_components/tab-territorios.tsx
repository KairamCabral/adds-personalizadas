"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, MapPin, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { RepresentanteTerritory, TerritoryConflict } from "@/services/representantes.service";
import {
  addRepresentanteTerritory,
  removeRepresentanteTerritory,
  checkTerritoryConflict,
} from "@/services/representantes.service";

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

interface TabTerritoriosProps {
  repId: string;
  repName: string;
  territories: RepresentanteTerritory[];
  loading: boolean;
}

interface RemoveTarget {
  id: string;
  city: string;
}

export function TabTerritorios({
  repId,
  repName,
  territories,
  loading,
}: TabTerritoriosProps) {
  const queryClient = useQueryClient();

  // Add form state
  const [state, setState] = useState("SC");
  const [city, setCity] = useState("");
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState<TerritoryConflict | null>(null);
  const [pendingAdd, setPendingAdd] = useState<{ city: string; state: string } | null>(null);

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  const addMutation = useMutation({
    mutationFn: ({ city, state }: { city: string; state: string }) =>
      addRepresentanteTerritory(repId, city, state),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representante-territories", repId] });
      queryClient.invalidateQueries({ queryKey: ["representante-kpis", repId] });
      toast.success("Cidade adicionada ao território");
      setCity("");
      setConflict(null);
      setPendingAdd(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar cidade", { description: err.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeRepresentanteTerritory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representante-territories", repId] });
      queryClient.invalidateQueries({ queryKey: ["representante-kpis", repId] });
      toast.success("Cidade removida do território");
      setRemoveTarget(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover cidade", { description: err.message });
    },
  });

  const handleAdd = async () => {
    if (!city.trim()) {
      toast.warning("Digite o nome da cidade");
      return;
    }

    setChecking(true);
    try {
      const conflict = await checkTerritoryConflict(city, state, repId);
      if (conflict) {
        setConflict(conflict);
        setPendingAdd({ city: city.trim(), state });
      } else {
        addMutation.mutate({ city: city.trim(), state });
      }
    } catch {
      // Se a tabela não existir ainda, tentar adicionar mesmo assim
      addMutation.mutate({ city: city.trim(), state });
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmConflict = () => {
    if (pendingAdd) {
      addMutation.mutate(pendingAdd);
    }
  };

  const handleCancelConflict = () => {
    setConflict(null);
    setPendingAdd(null);
  };

  return (
    <div className="space-y-6">
      {/* Lista de cidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Território de {repName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : territories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-10 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Nenhuma cidade atribuída</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use o formulário abaixo para adicionar cidades ao território.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Cidade</TableHead>
                    <TableHead className="font-semibold w-20">UF</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {territories.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.city}</TableCell>
                      <TableCell className="text-muted-foreground">{t.state}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRemoveTarget({ id: t.id, city: t.city })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formulário de adição */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar cidade</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Aviso de conflito */}
          {conflict && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                  <strong>{conflict.city}</strong> já está atribuída a{" "}
                  <strong>{conflict.otherRepName}</strong>. Adicionar mesmo assim?
                </span>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-amber-400 hover:bg-amber-100"
                    onClick={handleConfirmConflict}
                    disabled={addMutation.isPending}
                  >
                    Sim
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={handleCancelConflict}
                  >
                    Não
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Estado</label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BR.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">Cidade</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Nome da cidade..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>

            <Button
              onClick={handleAdd}
              disabled={checking || addMutation.isPending}
              className="shrink-0"
            >
              <Plus className="mr-2 h-4 w-4" />
              {checking ? "Verificando..." : addMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirm remove */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remover cidade do território"
        description={`Tem certeza que deseja remover "${removeTarget?.city}" do território de ${repName}?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        loading={removeMutation.isPending}
      />
    </div>
  );
}
