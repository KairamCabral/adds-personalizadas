"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Database, FileJson } from "lucide-react";
import { toast } from "sonner";

export default function SettingsBackupPage() {
  const router = useRouter();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);

  useEffect(() => {
    if (!permissionsLoading && !can("backup.manage")) {
      router.replace("/settings");
    }
  }, [permissionsLoading, router]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!can("backup.manage")) {
    return null;
  }

  const handleExportCSV = async () => {
    setExporting("csv");
    try {
      // Placeholder: em produção, chamaria uma API para gerar o CSV
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Exportação CSV iniciada. Em breve esta funcionalidade estará disponível.");
    } catch {
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportJSON = async () => {
    setExporting("json");
    try {
      // Placeholder: em produção, chamaria uma API para gerar o JSON
      await new Promise((r) => setTimeout(r, 500));
      toast.success("Exportação JSON iniciada. Em breve esta funcionalidade estará disponível.");
    } catch {
      toast.error("Erro ao exportar dados.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Backup"
        description="Exporte e restaure os dados do sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle>Exportar dados</CardTitle>
          <CardDescription>
            Baixe os dados do sistema nos formatos CSV ou JSON para backup ou
            análise externa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!!exporting}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={handleExportJSON}
            disabled={!!exporting}
          >
            <FileJson className="mr-2 h-4 w-4" />
            Exportar JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup e restauração</CardTitle>
          <CardDescription>
            Funcionalidades completas de backup e restauração serão
            disponibilizadas em versões futuras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            <Database className="mr-2 h-4 w-4" />
            Backup completo (em breve)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
