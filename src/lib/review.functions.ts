import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const GenerateInput = z.object({
  categoryIds: z.array(z.string().uuid()).max(10).optional(),
  artist: z.string().max(120).nullable().optional(),
  artistMode: z.enum(["auto", "always", "never"]).optional(),
  avoid: z.string().max(2000).optional(),
  avoidKeywords: z.array(z.string().max(120)).max(20).optional(),
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
    const lovableApiKey = apiKey;

    const supabase = publicClient();

    const [settingsRes, categoriesRes, presetsRes, keywordsRes] = await Promise.all([
      supabase.from("studio_settings").select("*").limit(1).maybeSingle(),
      supabase.from("review_categories").select("id, name, description").eq("is_active", true),
      supabase
        .from("review_presets")
        .select("id, content, tone, category_id, bangla_percent")
        .eq("is_active", true),
      supabase
        .from("review_keywords")
        .select("keyword, weight_percent")
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

    // Keywords: each keyword has its own admin-set frequency (weight_percent),
    // so it shows up in roughly that share of reviews. Max 2 per review, and a
    // regeneration never repeats the exact same keyword combination.
    const managed = (keywordsRes.data ?? [])
      .map((k) => ({ keyword: k.keyword.trim(), weight: k.weight_percent }))
      .filter((k) => Boolean(k.keyword));

    const fallbackKeywords = (settings?.experience_keywords ?? "")
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.toLowerCase() !== "dhaka tattoo studio" && Boolean(k))
      .map((keyword) => ({ keyword, weight: 40 }));

    const keywordPool = managed.length ? managed : fallbackKeywords;
    const avoidCombo = [...(data.avoidKeywords ?? [])].sort().join("|").toLowerCase();

    function rollKeywords(): string[] {
      const hits = keywordPool
        .filter((k) => Math.random() * 100 < k.weight)
        .map((k) => k.keyword);
      return pickSome(hits, Math.min(hits.length, 2));
    }

    let keywords = rollKeywords();
    for (let attempt = 0; attempt < 6; attempt++) {
      const combo = [...keywords].sort().join("|").toLowerCase();
      if (!avoidCombo || combo !== avoidCombo) break;
      keywords = rollKeywords();
    }

    // Artist name: customer toggle wins, otherwise the admin-set percentage.
    const artistPercent = Math.min(100, Math.max(0, settings?.artist_mention_percent ?? 70));
    const artistMode = data.artistMode ?? "auto";
    const mentionArtist =
      !!data.artist &&
      (artistMode === "always"
        ? true
        : artistMode === "never"
          ? false
          : Math.random() * 100 < artistPercent);

    // Language: Bangla share comes from the selected presets when configured,
    // otherwise the studio-wide default.
    const presetBanglaValues = presets
      .map((p) => p.bangla_percent)
      .filter((v): v is number => typeof v === "number");
    const banglaPercent = presetBanglaValues.length
      ? presetBanglaValues.reduce((a, b) => a + b, 0) / presetBanglaValues.length
      : (settings?.bangla_percent ?? 25);
    const useBangla = Math.random() * 100 < Math.min(100, Math.max(0, banglaPercent));


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

    const backstoryOptions = [
      "this was your first tattoo and you were nervous",
      "you came in with just a rough idea and trusted the artist",
      "a friend recommended the studio to you",
      "you got a cover-up and were worried about the result",
      "you wanted a custom design for something meaningful",
    ];
    const backstory = pickSome(backstoryOptions, 1)[0] ?? "you are a happy customer";

    const personaOptions = [
      "a 22-year-old university student typing casually on their phone",
      "a 28-year-old professional keeping it short and direct",
      "someone excited to recommend the studio to friends",
      "a first-timer who was nervous but impressed",
      "a returning customer comparing this visit to past experiences",
    ];
    const persona = pickSome(personaOptions, 1)[0] ?? "a happy customer";

    const sentenceCount = Math.floor(Math.random() * 5) + 2; // 2 to 6

    const studioName = settings?.studio_name || "InkPark Tattoo Studio";

    const framingOptions = [
      "a WhatsApp message to a close friend recommending the studio",
      "a short Reddit post sharing your experience",
      "a casual Facebook comment",
      "a diary-style note about your visit",
      "a quick text to a friend asking about tattoos",
    ];
    const framing = pickSome(framingOptions, 1)[0] ?? "a Google review";

    const systemPrompt = [
      settings?.ai_instructions ||
        `Write ${framing} from a happy customer of the studio. Use simple everyday first-person language. Every regeneration must use a different angle, opening, and vocabulary.`,
      "",
      "Hard rules:",
      "- Output ONLY the review text. No quotes, labels, headings, emojis or hashtags.",
      "- Sound like a real person typing on their phone, not marketing copy.",
      "- Never invent prices, dates, or promises.",
      "- Use only the keywords given for this review (if any), woven in naturally — never force them.",
      "- Vary sentence openings: don't start every review with 'I got' or 'The staff'.",
      useBangla
        ? "- Write this review in Bangla (Bengali script), the way a Dhaka customer would naturally type it. Studio and artist names stay in English."
        : "- Write this review in English.",
    ].join("\n");

    function buildPrompt(avoid?: string) {
      return [
        avoid
          ? `CRITICAL: Write a review that is clearly DIFFERENT from this previous version. Do NOT reuse its sentences, structure, opening, or main ideas.\nPrevious version:\n${avoid}`
          : "",
        "",
        `Voice and perspective for this review:`,
        `- Write as if you are ${persona}.`,
        `- The customer's backstory: ${backstory}.`,
        `- Style: ${style}.`,
        `- Length: exactly ${sentenceCount} sentences.`,
        `- Lead with the customer's ${focus}.`,
        `- The review must ${opening}.`,
        "",
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
        "",
        "Write the review now. Output ONLY the review text.",
      ]
        .filter(Boolean)
        .join("\n");
    }

    async function callAi(avoid?: string): Promise<string> {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableApiKey,
          "Cache-Control": "no-cache, no-store",
          "Pragma": "no-cache",
          "X-Request-Nonce": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna",
          // This model only supports the default temperature; variety comes from
          // the randomized persona/style/keyword prompt instead.

          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildPrompt(avoid) },
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
      return (payload.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    }

    let text = await callAi(data.avoid);
    if (!text) throw new Error("The AI returned an empty review. Try again.");

    // If a previous review exists and the new one is too similar, retry once with stronger avoidance.
    if (data.avoid) {
      const normalizedNew = text.toLowerCase().replace(/[^a-z\u0980-\u09ff]/g, "");
      const normalizedOld = data.avoid.toLowerCase().replace(/[^a-z\u0980-\u09ff]/g, "");
      const similarity = longestCommonSubstringLength(normalizedNew, normalizedOld) / Math.max(normalizedNew.length, normalizedOld.length, 1);
      if (similarity > 0.45) {
        const retry = await callAi(data.avoid);
        if (retry) text = retry;
      }
    }

    return { review: text, categories: selected.map((c) => c.name), keywords };
  });

function longestCommonSubstringLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let max = 0;
  const dp = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j] ?? 0;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1;
        max = Math.max(max, dp[j]!);
      } else {
        dp[j] = 0;
      }
      prev = temp;
    }
  }
  return max;
}
