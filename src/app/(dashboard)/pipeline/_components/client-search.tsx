"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClient as createClientService } from "@/services/clients.service";
import { syncRecentClients } from "@/services/tiny.service";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, RefreshCw } from "lucide-react";
import { cn, maskPhone, formatPhoneInput, formatDocumentInput } from "@/lib/utils";
import { toast } from "sonner";

export interface ClientSearchResult {
  id: string;
  tiny_id?: number | null;
  name: string;
  phone: string | null;
  document: string | null;
  company: string | null;
  source: "crm" | "tiny";
}

export interface SelectedClient {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
}

interface ClientSearchProps {
  selectedClient: SelectedClient | null;
  onClientSelect: (client: SelectedClient | null) => void;
}

/**
 * Indica se o nome parece ser conta interna/financeira (prolabore, salário, etc.)
 * Esses contatos não devem aparecer na busca para criação de pedidos.
 */
function isInternalOrFinancialContact(name: string | null, company: string | null): boolean {
  const text = [name, company].filter(Boolean).join(" ").toUpperCase();
  if (!text) return false;
  const patterns = [
    /\bPR[OÓ]\s*-?\s*LABORE\b/,
    /\bPROLABORE\b/,
    /\bSAL[ÁA]RIO\s+/,  // "Salário Nome" = conta de folha
    /\bDIVIDENDO\s+/,
    /\bS[OÓ]CIO\s+/,
    /\bRETIRADA\s+/,
    /\bFGTS\b/,
    /\bINSS\b/,
    /\bIMPOSTO\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function maskDocument(doc: string | null): string {
  if (!doc) return "—";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
  return doc;
}

export function ClientSearch({
  selectedClient,
  onClientSelect,
}: ClientSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [syncingRecent, setSyncingRecent] = useState(false);
  const { can } = usePermissions();
  const [quickForm, setQuickForm] = useState({
    name: "",
    phone: "",
    document: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const digitsOnly = q.replace(/\D/g, "");
      const useDigitsForContact =
        digitsOnly.length >= 10 && /^\d+$/.test(digitsOnly);
      const searchTerm = `%${q}%`;
      const digitsTerm = useDigitsForContact ? `%${digitsOnly}%` : searchTerm;

      const orConditions = [
        `name.ilike.${searchTerm}`,
        `company.ilike.${searchTerm}`,
        `phone.ilike.${digitsTerm}`,
        `document.ilike.${digitsTerm}`,
      ].join(",");

      const [localRes, tinyRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, phone, document, company, tiny_id")
          .or(orConditions)
          .limit(15),
        fetch(`/api/tiny/contacts/search?q=${encodeURIComponent(q)}`).then(
          (r) => r.json()
        ),
      ]);

      const localRows = (localRes.data ?? []) as Array<{
        id: string;
        name: string;
        phone: string | null;
        document: string | null;
        company: string | null;
        tiny_id: number | null;
      }>;
      const localItems: ClientSearchResult[] = localRows
        .filter(
          (c) => !isInternalOrFinancialContact(c.name, c.company)
        )
        .map((c) => ({
          id: c.id,
          tiny_id: c.tiny_id,
          name: c.name,
          phone: c.phone,
          document: c.document,
          company: c.company,
          source: "crm" as const,
        }));

      const tinyItems: ClientSearchResult[] = (tinyRes.items ?? [])
        .filter(
          (t: { name?: string; company?: string; tiny_id?: number }) =>
            !isInternalOrFinancialContact(t.name ?? null, t.company ?? null)
        )
        .filter(
          (t: ClientSearchResult) =>
            !localItems.some((l) => l.tiny_id && l.tiny_id === t.tiny_id)
        );

      setResults([...localItems, ...tinyItems]);
    } catch (err) {
      console.error(err);
      setResults([]);
      toast.error("Erro ao buscar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const handleSelect = async (item: ClientSearchResult) => {
    if (item.source === "tiny" && item.tiny_id) {
      const supabase = createClient();
      const tid = item.tiny_id;
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("tiny_id", tid as any)
        .maybeSingle();

      if (existing && typeof existing === "object" && "id" in existing) {
        onClientSelect({
          id: existing.id,
          name: item.name,
          phone: item.phone,
          document: item.document,
        });
      } else {
        try {
          const docLen = (item.document ?? "").replace(/\D/g, "").length;
          const created = await createClientService({
            name: item.name,
            phone: item.phone,
            document: item.document,
            company: item.company,
            tiny_id: item.tiny_id,
            person_type: docLen === 14 ? "JURIDICA" : "FISICA",
          });
          const c = created as unknown as { id: string; name: string; phone: string | null; document: string | null };
          onClientSelect({
            id: c.id,
            name: c.name,
            phone: c.phone,
            document: c.document,
          });
          toast.success("Cliente importado do Tiny");
        } catch (err) {
          toast.error("Erro ao importar cliente");
          return;
        }
      }
    } else {
      onClientSelect({
        id: item.id,
        name: item.name,
        phone: item.phone,
        document: item.document,
      });
    }
    setQuery("");
    setResults([]);
  };

  const handleSyncRecent = async () => {
    setSyncingRecent(true);
    try {
      const result = await syncRecentClients();
      if (result.success) {
        toast.success(
          result.synced && result.synced > 0
            ? `${result.synced} contatos sincronizados do Tiny`
            : "Nenhum contato novo no Tiny"
        );
        if (result.synced && result.synced > 0 && debouncedQuery.length >= 3) {
          search(debouncedQuery);
        }
      } else {
        toast.error("Erro ao sincronizar contatos recentes");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao sincronizar contatos"
      );
    } finally {
      setSyncingRecent(false);
    }
  };

  const handleQuickCreate = async () => {
    if (!quickForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      const doc = quickForm.document.trim() || null;
      const phone = quickForm.phone.trim() || null;
      const docDigits = doc ? doc.replace(/\D/g, "") : "";
      const docLen = docDigits.length;

      // Validação por CPF/CNPJ: evita duplicatas no CRM
      if (docDigits.length >= 11) {
        let existing: { id: string; name: string; phone: string | null; document: string | null } | null = null;
        try {
          const findRes = await fetch(
            `/api/clients/find-by-document?document=${encodeURIComponent(doc ?? "")}`
          );
          if (!findRes.ok) throw new Error("Busca por documento falhou");
          const data = await findRes.json();
          existing = data.client ?? null;
        } catch {
          toast.error("Erro ao verificar CPF/CNPJ. Tente novamente.");
          return;
        }
        if (existing) {
          onClientSelect({
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
            document: existing.document,
          });
          setShowQuickForm(false);
          setQuickForm({ name: "", phone: "", document: "" });
          setQuery("");
          setResults([]);
          toast.success("Cliente já cadastrado (CPF/CNPJ encontrado)");
          return;
        }
      }

      let tinyId: number | null = null;
      let tinyFeedbackShown = false;
      try {
        const res = await fetch("/api/tiny/contacts/create-or-find", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: quickForm.name.trim(),
            phone: phone || undefined,
            document: doc || undefined,
          }),
        });
        const data = await res.json();
        if (data.error) {
          toast.warning("Cliente salvo no CRM. Tiny: " + data.error);
          tinyFeedbackShown = true;
        } else if (data.tiny_id) {
          tinyId = data.tiny_id;
          if (data.found) {
            toast.success("Cliente encontrado no Tiny e vinculado");
          } else {
            toast.success("Cliente cadastrado no CRM e no Tiny");
          }
          tinyFeedbackShown = true;
        }
      } catch {
        toast.info("Cliente salvo no CRM. Não foi possível conectar ao Tiny.");
        tinyFeedbackShown = true;
      }

      const created = await createClientService({
        name: quickForm.name.trim(),
        phone: phone || null,
        document: doc,
        person_type: docLen === 14 ? "JURIDICA" : "FISICA",
        tiny_id: tinyId,
      });
      const newClient = created as unknown as { id: string; name: string; phone: string | null; document: string | null };
      onClientSelect({
        id: newClient.id,
        name: newClient.name,
        phone: newClient.phone,
        document: newClient.document,
      });
      setShowQuickForm(false);
      setQuickForm({ name: "", phone: "", document: "" });
      setQuery("");
      setResults([]);
      if (!tinyId && !tinyFeedbackShown) toast.success("Cliente cadastrado no CRM");
    } catch (err) {
      toast.error("Erro ao cadastrar cliente");
    }
  };

  if (selectedClient) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">{selectedClient.name}</p>
            {(selectedClient.phone || selectedClient.document) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedClient.phone && maskPhone(selectedClient.phone)}
                {selectedClient.phone && selectedClient.document && " · "}
                {selectedClient.document &&
                  maskDocument(selectedClient.document)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClientSelect(null)}
          >
            Trocar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      {can("clients.sync_tiny") && (
        <button
          type="button"
          onClick={handleSyncRecent}
          disabled={syncingRecent}
          className="flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={cn("h-4 w-4 shrink-0", syncingRecent && "animate-spin")}
          />
          {syncingRecent ? "Sincronizando..." : "Sincronizar recentes"}
        </button>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Buscando...</p>
      )}

      {!loading && debouncedQuery.length >= 3 && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum cliente encontrado
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary",
                item.source === "tiny" && "bg-primary/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.phone && maskPhone(item.phone)}
                  {item.phone && item.document && " · "}
                  {item.document && maskDocument(item.document)}
                </p>
              </div>
              <Badge
                variant={item.source === "crm" ? "secondary" : "outline"}
                className="shrink-0"
              >
                {item.source === "crm" ? "CRM" : "Tiny"}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {!showQuickForm ? (
        <button
          type="button"
          onClick={() => setShowQuickForm(true)}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <UserPlus className="h-4 w-4" />
          Cliente não encontrado? Cadastrar novo
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium">Cadastrar novo cliente</p>
          <Input
            placeholder="Nome *"
            value={quickForm.name}
            onChange={(e) =>
              setQuickForm((p) => ({ ...p, name: e.target.value }))
            }
          />
          <Input
            placeholder="(00) 00000-0000"
            value={quickForm.phone}
            onChange={(e) =>
              setQuickForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))
            }
          />
          <Input
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            value={quickForm.document}
            onChange={(e) =>
              setQuickForm((p) => ({ ...p, document: formatDocumentInput(e.target.value) }))
            }
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleQuickCreate}>
              Salvar e usar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowQuickForm(false);
                setQuickForm({ name: "", phone: "", document: "" });
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
