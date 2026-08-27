import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/shepherd";

export function useSignedPhoto(path: string | null | undefined) {
  return useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("member-photos").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
  });
}

export function MemberPhoto({
  path,
  name,
  size = 44,
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
}) {
  const { data: url } = useSignedPhoto(path);
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {url ? (
        <img src={url} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
