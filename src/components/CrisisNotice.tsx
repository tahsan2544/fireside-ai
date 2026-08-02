import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CRISIS_RESOURCES } from "@/lib/safety";
import { LifeBuoy } from "lucide-react";

export function CrisisNotice({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="serif flex items-center gap-2 text-xl">
            <LifeBuoy className="h-5 w-5 text-primary" />
            I'm still here with you
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          What you said sounds heavy. You can keep talking to me for as long as you want — nothing here closes. But
          please also reach out to a real person tonight, someone who can sit with you.
        </p>
        <ul className="mt-2 space-y-3">
          {CRISIS_RESOURCES.map((r) => (
            <li key={r.region} className="rounded-lg bg-accent/40 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.region}</p>
              <p className="font-medium">{r.name}</p>
              <p className="text-muted-foreground">{r.contact}</p>
              <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                {r.url.replace("https://", "")}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs italic text-muted-foreground">
          If you are in immediate danger, please call your local emergency number.
        </p>
      </DialogContent>
    </Dialog>
  );
}
