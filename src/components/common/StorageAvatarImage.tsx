import { AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/hooks/use-avatar-url";

/**
 * Affiche une photo de profil stockée dans le bucket privé "avatars".
 * Le chemin brut n'est pas une URL : il faut une URL signée, sinon le
 * navigateur demande une ressource inexistante (404).
 */
export function StorageAvatarImage({ path, alt = "" }: { path?: string | null; alt?: string }) {
  const { data: url } = useAvatarUrl(path);
  if (!url) return null;
  return <AvatarImage src={url} alt={alt} />;
}
