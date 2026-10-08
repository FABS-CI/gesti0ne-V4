import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { HardDrive, Upload, Download, Trash2, File as FileIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/components/rbac/Can";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/file-storage")({
  component: FileStoragePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const BUCKET = "documents-fabs";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

type StoredFile = {
  name: string;
  id: string | null;
  metadata: { size?: number; mimetype?: string } | null;
  created_at: string | null;
};

function FileStoragePage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["file-storage"],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list("", {
        sortBy: { column: "created_at", order: "desc" },
        limit: 200,
      });
      if (error) throw error;
      return (data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder") as StoredFile[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage.from(BUCKET).remove([name]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fichier supprimé");
      qc.invalidateQueries({ queryKey: ["file-storage"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      toast.success("Fichier téléversé");
      qc.invalidateQueries({ queryKey: ["file-storage"] });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(name: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, 60);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-primary" /> Stockage de fichiers
          </h1>
          <p className="text-sm text-muted-foreground">
            Documents et pièces jointes de l'entreprise
          </p>
        </div>
        <div>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Téléversement..." : "Téléverser"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du fichier</TableHead>
                <TableHead className="text-right">Taille</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Aucun fichier
                  </TableCell>
                </TableRow>
              ) : (
                files.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                      {f.name.replace(/^\d+_/, "")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatSize(f.metadata?.size ?? 0)}
                    </TableCell>
                    <TableCell>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(f.name)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Can permission="documents.supprimer">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(f.name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
