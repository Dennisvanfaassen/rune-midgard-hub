import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/guild-blue-logo.png.asset.json";

export function CharacterPortrait({ path, name, className = "h-24 w-24" }: { path?: string | null; name: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["portrait", path], enabled: !!path, staleTime: 3000_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from("character-portraits").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return <img src={data || logo.url} alt={`${name}'s character`} className={`shrink-0 object-contain ${className}`} />;
}