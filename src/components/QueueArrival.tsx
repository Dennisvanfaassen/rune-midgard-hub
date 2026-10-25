import { Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QueueEntry } from "@/lib/party-queue";

export function QueueArrival({
  entries,
  onView,
  onDismiss,
}: {
  entries: QueueEntry[];
  onView: () => void;
  onDismiss: () => void;
}) {
  const first = entries[0];
  if (!first) return null;
  return (
    <section
      aria-label="Party Queue arrival"
      className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-primary/50 bg-card text-card-foreground shadow-2xl shadow-primary/15"
    >
      <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/10 p-4">
        <span className="rounded-xl bg-primary/20 p-2.5 text-primary">
          <Swords className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Party Queue
          </p>
          <h2 className="mt-1 font-display text-base font-bold">A guildmate is ready!</h2>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss queue alert"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm">
          <strong>{first.char_name}</strong> joined the queue
          {entries.length > 1 ? ` with ${entries.length - 1} more guildmate(s)` : ""}.
        </p>
        <p className="text-xs text-muted-foreground">
          Lv. {first.base_lv} {first.job} ·{" "}
          {first.activity === "Any" ? "Up for anything" : first.activity}
          {first.location && ` · ${first.location}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Find your next duo or party. Meet up in Ragnarok!
        </p>
        <Button className="w-full" onClick={onView}>
          <Swords className="mr-2 h-4 w-4" />
          View available guildmates
        </Button>
      </div>
    </section>
  );
}
