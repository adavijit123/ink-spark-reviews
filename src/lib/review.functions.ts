import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const GenerateInput = z.object({
  categoryIds: z.array(z.string().uuid()).max(10).optional(),
  artist: z.string().max(120).nullable().optional(),
  avoid: z.string().max(2000).optional(),
});

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function pickSome<T>(items: T[], count: number): T[] {
  const copy = [...items];
  const out: T[] = [];
  while (copy.length && out.length < count) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]!);
  }
  return out;
}

export const generateReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured yet.");

    const supabase = publicClient();

    const [settingsRes, categoriesRes, presetsRes] = await Promise.all([
      supabase.from("studio_settings").select("*").limit(1).maybeSingle(),
      supabase.from("review_categories").select("id, name, description").eq("is_active", true),
      supabase
        .from("review_presets")
        .select("id, content, tone, category_id")
        .eq("is_active", true),
    ]);

    const settings = settingsRes.data;
    const categories = categoriesRes.data ?? [];
    const allPresets = presetsRes.data ?? [];

    const selectedIds = data.categoryIds ?? [];
    const selected = categories.filter((c) => selectedIds.includes(c.id));

    const scoped = selected.length
      ? allPresets.filter((p) => p.category_id && selectedIds.includes(p.category_id))
      : allPresets;
    const presets = pickSome(scoped.length ? scoped : allPresets, 4);
    const keywords = pickSome(
      (settings?.experience_keywords ?? "")
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
      3,
    );

    const studioName = settings?.studio_name || "InkPark Tattoo Studio";

    const systemPrompt = [
      settings?.ai_instructions ||
        "Write a short, natural-sounding Google review from a happy customer. 2-4 sentences, first person, everyday language.",
      "",
      "Hard rules:",
      "- Output ONLY the review text. No quotes, labels, headings, emojis or hashtags.",
      "- 2 to 4 sentences, under 400 characters.",
      "- Sound like a real person typing on their phone, not marketing copy.",
      "- Never invent prices, dates, or promises.",
    ].join("\n");

    const userPrompt = [
      `Studio: ${studioName}`,
      settings?.studio_info ? `About: ${settings.studio_info}` : "",
      settings?.services ? `Services: ${settings.services}` : "",
      settings?.artists ? `Artists: ${settings.artists}` : "",
      keywords.length ? `Experience keywords to lean on: ${keywords.join(", ")}` : "",
      category ? `Review angle: ${category.name} — ${category.description}` : "",
      presets.length
        ? `Preset ideas for inspiration (rephrase, do not copy):\n${presets
            .map((p) => `- (${p.tone}) ${p.content}`)
            .join("\n")}`
        : "",
      data.avoid ? `Write something clearly different from this previous version:\n${data.avoid}` : "",
      `Randomness seed: ${Math.random().toString(36).slice(2)}`,
      "",
      "Write the review now.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        temperature: 1.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("Too many requests right now — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits are exhausted. Please contact the studio.");
      throw new Error(`Review generation failed (${res.status}). ${detail.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (payload.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (!text) throw new Error("The AI returned an empty review. Try again.");

    return { review: text, category: category?.name ?? null };
  });
