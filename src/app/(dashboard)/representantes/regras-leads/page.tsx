"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Route,
  Lightbulb,
  Info,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
  UserX,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { RuleFormDialog } from "./_components/rule-form-dialog";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type MatchField = "utm_campaign" | "utm_source" | "utm_medium" | "utm_content";
export type MatchOperator = "equals" | "contains" | "starts_with";
export type RouteType = "territory" | "specific_rep";

export interface RepLeadRule {
  id: string;
  name: string;
  match_field: MatchField;
  match_operator: MatchOperator;
  match_value: string;
  route_type: RouteType;
  target_rep_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  target_rep?: { full_name: string } | null;
}

export interface RepresentanteSimple {
  id: string;
  full_name: string;
}

export interface RepTerritory {
  rep_id: string;
  city: string;
  state: string;
  rep?: { full_name: string } | null;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const FIELD_LABELS: Record<MatchField, string> = {
  utm_campaign: "utm_campaign",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_content: "utm_content",
};

const OPERATOR_LABELS: Record<MatchOperator, string> = {
  equals: "igual a",
  contains: "contém",
  starts_with: "começa com",
};

function matchesRule(
  rule: RepLeadRule,
  utmSource: string,
  utmCampaign: string,
  utmMedium: string,
  utmContent: string
): boolean {
  const fieldValues: Record<MatchField, string> = {
    utm_source: utmSource.toLowerCase(),
    utm_campaign: utmCampaign.toLowerCase(),
    utm_medium: utmMedium.toLowerCase(),
    utm_content: utmContent.toLowerCase(),
  };
  const fieldValue = fieldValues[rule.match_field];
  const ruleValue = rule.match_value.toLowerCase();

  switch (rule.match_operator) {
    case "equals":
      return fieldValue === ruleValue;
    case "contains":
      return fieldValue.includes(ruleValue);
    case "starts_with":
      return fieldValue.startsWith(ruleValue);
    default:
      return false;
  }
}

// ──────────────────────────────────────────────
// Data fetching
// ──────────────────────────────────────────────

async function fetchRules(): Promise<RepLeadRule[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rep_lead_rules" as never)
    .select("*, target_rep:profiles!target_rep_id(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RepLeadRule[];
}

async function fetchRepresentantes(): Promise<RepresentanteSimple[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "REPRESENTANTE")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as RepresentanteSimple[];
}

async function fetchTerritories(): Promise<RepTerritory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rep_territories")
    .select("rep_id, city, state, rep:profiles!rep_id(full_name)");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RepTerritory[];
}

// ──────────────────────────────────────────────
// Simulador
// ──────────────────────────────────────────────

interface SimulatorResult {
  matched: boolean;
  ruleName?: string;
  repName?: string;
  routeType?: RouteType;
}

function SimulatorSection({
  rules,
  territories,
  representantes,
}: {
  rules: RepLeadRule[];
  territories: RepTerritory[];
  representantes: RepresentanteSimple[];
}) {
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [city, setCity] = useState("");
  const [result, setResult] = useState<SimulatorResult | null>(null);

  function simulate() {
    if (!utmSource && !utmCampaign && !utmMedium && !utmContent) {
      toast.warning("Preencha ao menos um parâmetro UTM para simular.");
      return;
    }

    const activeRules = rules.filter((r) => r.is_active);
    const matched = activeRules.find((r) =>
      matchesRule(r, utmSource, utmCampaign, utmMedium, utmContent)
    );

    if (!matched) {
      setResult({ matched: false });
      return;
    }

    if (matched.route_type === "specific_rep") {
      const rep = representantes.find((r) => r.id === matched.target_rep_id);
      setResult({
        matched: true,
        ruleName: matched.name,
        repName: rep?.full_name ?? matched.target_rep?.full_name ?? "Representante",
        routeType: "specific_rep",
      });
      return;
    }

    // territory: buscar rep pelo território
    const cityNorm = city.trim().toLowerCase();
    const territory = cityNorm
      ? territories.find((t) => t.city.toLowerCase() === cityNorm)
      : null;

    setResult({
      matched: true,
      ruleName: matched.name,
      repName: territory?.rep?.full_name ?? "(rep do território da cidade informada)",
      routeType: "territory",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          Simulador de Roteamento
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Teste como um lead seria roteado com base nas regras ativas.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">utm_source</Label>
            <Input
              placeholder="ex: google"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">utm_campaign</Label>
            <Input
              placeholder="ex: representante_sc"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">utm_medium</Label>
            <Input
              placeholder="ex: cpc"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">utm_content</Label>
            <Input
              placeholder="ex: banner_home"
              value={utmContent}
              onChange={(e) => setUtmContent(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label className="text-xs text-muted-foreground">
              Cidade do lead <span className="text-muted-foreground/60">(para roteamento por território)</span>
            </Label>
            <Input
              placeholder="ex: Balneário Camboriú"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <Button onClick={simulate} className="self-end">
            <Play className="mr-2 h-4 w-4" />
            Simular
          </Button>
        </div>

        {result !== null && (
          <div
            className={`rounded-lg border p-4 ${
              result.matched
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : "border-muted bg-muted/40"
            }`}
          >
            {result.matched ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                ✅ Lead seria encaminhado para{" "}
                <strong>{result.repName}</strong>
                {result.routeType === "territory"
                  ? " (roteamento por território)"
                  : " (representante específico)"}
                {result.ruleName && (
                  <span className="text-muted-foreground font-normal">
                    {" "}— regra: <em>{result.ruleName}</em>
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                ⚠️ Nenhuma regra ativa corresponde a esses parâmetros — lead ficaria na equipe interna.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────

export default function RegrasLeadsPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const { profile } = useUser();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RepLeadRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RepLeadRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rep-lead-rules"],
    queryFn: fetchRules,
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 60_000,
  });

  const { data: representantes = [] } = useQuery({
    queryKey: ["representantes-simple"],
    queryFn: fetchRepresentantes,
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 5 * 60_000,
  });

  const { data: territories = [] } = useQuery({
    queryKey: ["rep-territories-all"],
    queryFn: fetchTerritories,
    enabled: !permissionsLoading && can("representantes.view"),
    staleTime: 5 * 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: RepLeadRule) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("rep_lead_rules" as never)
        .update({ is_active: !rule.is_active } as never)
        .eq("id", rule.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-lead-rules"] });
      toast.success("Status da regra atualizado");
    },
    onError: (err: Error) => toast.error("Erro ao atualizar regra", { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("rep_lead_rules" as never)
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rep-lead-rules"] });
      toast.success("Regra removida");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error("Erro ao remover regra", { description: err.message }),
  });

  // Permissão
  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!can("representantes.view")) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center">
        <UserX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  function handleNewRule() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function handleEdit(rule: RepLeadRule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Regras de Roteamento de Leads"
        description="Configure quais campanhas encaminham leads para representantes automaticamente"
      >
        <Button onClick={handleNewRule}>
          <Plus className="mr-2 h-4 w-4" />
          Nova regra
        </Button>
      </PageHeader>

      {/* Como funciona */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="flex gap-3 pt-4 pb-4">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Como funciona o roteamento
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Quando um lead chega pelo formulário público com parâmetros UTM, o sistema verifica as
              regras abaixo em ordem. Se encontrar correspondência, cria um card automaticamente no
              CRM do representante do território — ou do representante específico configurado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de regras */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
          <Route className="h-4 w-4" />
          Regras ativas
        </h2>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Route className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Nenhuma regra cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique em &quot;Nova regra&quot; para começar.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">Campo UTM</TableHead>
                      <TableHead className="font-semibold">Operador</TableHead>
                      <TableHead className="font-semibold">Valor</TableHead>
                      <TableHead className="font-semibold">Roteamento</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {FIELD_LABELS[rule.match_field]}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {OPERATOR_LABELS[rule.match_operator]}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {rule.match_value}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm">
                          {rule.route_type === "territory" ? (
                            <span className="text-muted-foreground">Por território</span>
                          ) : (
                            <span className="font-medium">
                              {rule.target_rep?.full_name ?? "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={rule.is_active ? "default" : "secondary"}
                            className={
                              rule.is_active
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                                : ""
                            }
                          >
                            {rule.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              title={rule.is_active ? "Desativar" : "Ativar"}
                              onClick={() => toggleMutation.mutate(rule)}
                              disabled={toggleMutation.isPending}
                            >
                              {rule.is_active ? (
                                <ToggleRight className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Editar"
                              onClick={() => handleEdit(rule)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Excluir"
                              onClick={() => setDeleteTarget(rule)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Simulador */}
      <SimulatorSection
        rules={rules}
        territories={territories}
        representantes={representantes}
      />

      {/* Exemplos */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Lightbulb className="h-4 w-4" />
            Exemplos de configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>
                Campanhas com &quot;representante&quot; no nome → encaminhar por território
                <br />
                <code className="text-xs bg-amber-100 dark:bg-amber-900/40 rounded px-1">
                  utm_campaign | contém | representante
                </code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>
                Campanha específica para um rep → encaminhar direto
                <br />
                <code className="text-xs bg-amber-100 dark:bg-amber-900/40 rounded px-1">
                  utm_campaign | igual a | rep_marcos_bc | Rep: Marcos
                </code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              <span>
                Todo lead do Meta com tag de rep → encaminhar por território
                <br />
                <code className="text-xs bg-amber-100 dark:bg-amber-900/40 rounded px-1">
                  utm_source | igual a | meta_representante
                </code>
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRule(null);
        }}
        editingRule={editingRule}
        representantes={representantes}
        userId={profile?.id ?? ""}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remover regra"
        description={`Tem certeza que deseja remover a regra "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
