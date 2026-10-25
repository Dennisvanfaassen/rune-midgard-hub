import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { queueSnapshotSchema, type QueueDraft } from "@/lib/party-queue";

// Typed extension for migration 0019; keep the generated client untouched.
type QueueDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      party_queue_snapshot: { Args: Record<string, never>; Returns: Json };
      party_queue_join: {
        Args: { p_activity: string; p_role: string; p_location: string; p_note: string };
        Returns: string;
      };
      party_queue_leave: { Args: { p_entry_id: string }; Returns: undefined };
      party_queue_extend: { Args: { p_entry_id: string }; Returns: undefined };
    };
  };
};
const client = supabase as unknown as SupabaseClient<QueueDatabase>;

export async function readQueue(signal: AbortSignal) {
  const { data, error } = await client.rpc("party_queue_snapshot").abortSignal(signal);
  if (error) throw error;
  return { ...queueSnapshotSchema.parse(data), receivedAt: Date.now() };
}
export async function joinQueue(draft: QueueDraft) {
  const { error } = await client.rpc("party_queue_join", {
    p_activity: draft.activity,
    p_role: draft.role,
    p_location: draft.location,
    p_note: draft.note,
  });
  if (error) throw error;
}
export async function changeQueue(action: "leave" | "extend", entryId: string) {
  const { error } = await client.rpc(
    action === "leave" ? "party_queue_leave" : "party_queue_extend",
    { p_entry_id: entryId },
  );
  if (error) throw error;
}
