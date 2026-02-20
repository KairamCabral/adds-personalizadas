"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatFileSize, formatRelativeTime } from "@/lib/utils";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { FileIcon, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useState } from "react";

const BUCKET = "attachments";

interface Attachment {
  id: string;
  order_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploader: { id: string; full_name: string } | null;
  created_at: string;
}

interface OrderAttachmentsProps {
  orderId: string;
}

async function fetchAttachments(orderId: string): Promise<Attachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*, uploader:profiles!attachments_uploaded_by_fkey(id, full_name)")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
.eq("order_id", orderId as any)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Attachment[];
}

async function uploadAttachment(
  orderId: string,
  file: File
): Promise<Attachment> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const ext = file.name.split(".").pop() || "";
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      order_id: orderId,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      uploaded_by: user.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("*, uploader:profiles!attachments_uploaded_by_fkey(id, full_name)")
    .single();

  if (error) throw error;
  return data as unknown as Attachment;
}

async function deleteAttachment(id: string, fileUrl: string): Promise<void> {
  const supabase = createClient();
  const pathMatch = fileUrl.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  if (pathMatch) {
    await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("attachments").delete().eq("id", id as any);
  if (error) throw error;
}

export function OrderAttachments({ orderId }: OrderAttachmentsProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [uploadKey, setUploadKey] = useState(0);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["attachments", orderId],
    queryFn: () => fetchAttachments(orderId),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(files.map((f) => uploadAttachment(orderId, f))),
    onSuccess: () => {
      setUploadKey((k) => k + 1);
      queryClient.invalidateQueries({ queryKey: ["attachments", orderId] });
      toast.success("Anexos adicionados com sucesso.");
    },
    onError: () => {
      setUploadKey((k) => k + 1);
      toast.error("Erro ao enviar anexos.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, fileUrl }: { id: string; fileUrl: string }) =>
      deleteAttachment(id, fileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments", orderId] });
      setDeleteTarget(null);
      toast.success("Anexo excluído.");
    },
    onError: () => {
      toast.error("Erro ao excluir anexo.");
    },
  });

  function handleUpload(files: File[]) {
    if (files.length) uploadMutation.mutate(files);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Carregando anexos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FileUpload
        key={uploadKey}
        multiple
        accept="image/jpeg,image/jpg,image/png,image/svg+xml,application/pdf,.cdr,.ai,.eps,.svg"
        onUpload={handleUpload}
        disabled={uploadMutation.isPending}
        isUploading={uploadMutation.isPending}
      />

      {attachments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum anexo ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {att.file_size != null && formatFileSize(att.file_size)}
                  {att.uploader && ` • ${att.uploader.full_name}`}
                  {" • "}
                  {formatRelativeTime(att.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={att.file_url} download={att.file_name} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(att)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir anexo"
        description="Tem certeza que deseja excluir este anexo?"
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() =>
          deleteTarget &&
          deleteMutation.mutate({ id: deleteTarget.id, fileUrl: deleteTarget.file_url })
        }
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
