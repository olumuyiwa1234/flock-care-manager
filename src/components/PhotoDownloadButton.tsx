import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSignedPhoto } from "@/components/MemberPhoto";

export function PhotoDownloadButton({
  path,
  name,
}: {
  path: string | null | undefined;
  name: string;
}) {
  const { data: url } = useSignedPhoto(path);
  const [busy, setBusy] = useState(false);

  if (!path) return null;

  async function download() {
    if (!url) {
      toast.error("Photo is not ready yet");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not fetch the photo");
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${name.replace(/[^\w\s-]/g, "").trim() || "member"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2"
      disabled={busy}
      onClick={() => void download()}
    >
      <Download className="mr-2 size-4" />
      {busy ? "Downloading…" : "Download photo"}
    </Button>
  );
}
