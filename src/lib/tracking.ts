import { supabase } from "@/integrations/supabase/client";

const KEY = "inkpark_session_id";

export function getSessionId() {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

type EventType = "page_view" | "generate" | "copy_open" | "confirm";

export async function logEvent(
  event_type: EventType,
  extra: {
    rating?: number | null;
    email?: string | null;
    language?: string | null;
    artist?: string | null;
  } = {},
) {
  if (typeof window === "undefined") return;
  try {
    await supabase.from("review_events").insert({
      event_type,
      session_id: getSessionId(),
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      rating: extra.rating ?? null,
      email: extra.email ?? null,
      language: extra.language ?? null,
      artist: extra.artist ?? null,
    });
  } catch {
    // tracking must never break the customer flow
  }
}
