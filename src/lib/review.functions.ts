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

    // Keywords: pick 0–2 at random so different reviews lean on different ones
    // (and some use none) instead of stuffing every keyword into each review.
    // Also drop the deprecated "Dhaka Tattoo Studio" keyword just in case.
    const allKeywords = (settings?.experience_keywords ?? "")
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.toLowerCase() !== "dhaka tattoo studio" && Boolean(k));
    const keywords = pickSome(allKeywords, Math.floor(Math.random() * 3));

    // Artist name: mention in ~70% of reviews.
    const mentionArtist = !!data.artist && Math.random() < 0.7;

    // Language: ~25% of reviews in Bangla (Bengali), rest in English.
    const useBangla = Math.random() < 0.25;

    // Vary the review focus/structure each time so regenerations feel different.
    const focusOptions = [
      "overall experience and vibe",
      "artist skill and personality",
      "final tattoo result and quality",
      "process, hygiene and comfort",
      "recommendation to friends",
    ];
    const focus = pickSome(focusOptions, 1)[0] ?? "overall experience";

    const styleOptions = [
      "casual and conversational",
      "a little storytelling",
      "short and punchy",
      "warm and appreciative",
      "detail-focused",
    ];
    const style = pickSome(styleOptions, 1)[0] ?? "casual";

    const openingOptions = [
      "start by describing the studio vibe when you walked in",
      "start by mentioning the artist's behaviour and patience",
      "start by describing the final tattoo result in detail",
      "start by talking about hygiene and the process",
      "start by saying why you chose this studio",
    ];
    const opening = pickSome(openingOptions, 1)[0] ?? "start by describing the studio vibe";

    const studioName = settings?.studio_name || "InkPark Tattoo Studio";

    const systemPrompt = [
      settings?.ai_instructions ||
        "Write a natural-sounding Google review from a happy customer of the studio. Use simple everyday first-person language. Vary the review structure every single time.",
      "",
      "Hard rules:",
      "- Output ONLY the review text. No quotes, labels, headings, emojis or hashtags.",
      "- 2 to 6 sentences, under 700 characters. Mix shorter and longer reviews — some brief, some with a little more detail.",
      "- Sound like a real person typing on their phone, not marketing copy.",
      "- Never invent prices, dates, or promises.",
      "- Use only the keywords given for this review (if any), woven in naturally — never force them.",
      "- Vary sentence openings: don't start every review with 'I got' or 'The staff'.",
      "- Every regeneration must be clearly different. Change the angle, wording, and which details you emphasize.",
      useBangla
        ? "- Write this review in Bangla (Bengali script), the way a Dhaka customer would naturally type it. Studio and artist names stay in English."
        : "- Write this review in English.",
    ].join("\n");

    const userPrompt = [
      `Studio: ${studioName}`,
      settings?.studio_info ? `About: ${settings.studio_info}` : "",
      settings?.services ? `Services: ${settings.services}` : "",
      settings?.artists ? `Artists: ${settings.artists}` : "",
      keywords.length
        ? `Keywords to use in THIS review (use naturally, only these): ${keywords.join(", ")}`
        : "Use no SEO-style keywords in this review — keep it plain and natural.",
      selected.length
        ? `Review angles to weave in naturally (cover all of them):\n${selected
            .map((c) => `- ${c.name} — ${c.description}`)
            .join("\n")}`
        : "",
      data.artist
        ? mentionArtist
          ? `The customer's tattoo artist was ${data.artist}. Mention ${data.artist} by name as the artist who did the tattoo. Do not name any other artist.`
          : `The customer's tattoo artist was ${data.artist}, but do NOT mention any artist name in this review.`
        : "",
      presets.length
        ? `Preset ideas for inspiration (rephrase, do not copy):\n${presets
            .map((p) => `- (${p.tone}) ${p.content}`)
            .join("\n")}`
        : "",
      `For this review, lead with the customer's ${focus}. Make the style ${style}. The review must ${opening}. Make it feel completely different from previous reviews.`,
      data.avoid ? `Write something clearly different from this previous version — do NOT reuse its sentences, structure, or main ideas:\n${data.avoid}` : "",
      `Unique request nonce: ${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
        temperature: 1.4,
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

    return { review: text, categories: selected.map((c) => c.name) };
  });
