import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, KeyRound, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/hooks/use-avatar-url";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/profil")({
  component: Profil,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function Profil() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, refetch } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data as {
        nom_complet: string | null;
        email: string | null;
        avatar_url: string | null;
      } | null;
    },
  });

  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_url);

  useEffect(() => {
    if (profile?.nom_complet) setNom(profile.nom_complet);
  }, [profile?.nom_complet]);

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(friendlyError(upErr));
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", user.id);
    setUploading(false);
    if (updErr) toast.error(friendlyError(updErr));
    else {
      toast.success("Photo mise à jour");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["avatar-signed-url"] });
      refetch();
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nom_complet: nom.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Profil mis à jour");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      refetch();
    }
  };

  const savePassword = async () => {
    if (pwd.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPwdSaving(false);
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Mot de passe modifié");
      setPwd("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title">Mon profil</h1>
        <p className="text-sm text-muted-foreground">Gérez vos informations personnelles</p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Photo de profil" /> : null}
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {(nom || user?.email || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />
              <Button type="button" variant="outline" onClick={onPickFile} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {profile?.avatar_url ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG/PNG, 5 Mo max.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Sécurité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pwd">Nouveau mot de passe</Label>
            <Input
              id="pwd"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button variant="outline" onClick={savePassword} disabled={pwdSaving}>
            {pwdSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Enregistrer le mot de passe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
