import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, Sparkles, Star, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { generateReview } from "@/lib/review.functions";
import { Button } from "@/components/ui/button";
import googleReviewLogo from "@/assets/review-us-on-google.jpeg.asset.json";


const FALLBACK_URL = "https://g.page/r/Cf-vHSmJ-os4EB0/review";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Leave a Review — InkPark Tattoo Studio" },
      {
        name: "description",
        content:
          "Loved your tattoo? Generate a natural review in one tap, copy it, and post it to InkPark Tattoo Studio's Google page.",
      },
      { property: "og:title", content: "Leave a Review — InkPark Tattoo Studio" },
      {
        property: "og:description",
        content: "Generate, edit and copy your InkPark review in seconds.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://ink-spark-reviews.lovable.app/__l5e/assets-v1/d4e9d1a6-e1bb-4d5f-bacb-fcc61b864309/google-verified-reviews.jpeg",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content:
          "https://ink-spark-reviews.lovable.app/__l5e/assets-v1/d4e9d1a6-e1bb-4d5f-bacb-fcc61b864309/google-verified-reviews.jpeg",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const generate = useServerFn(generateReview);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [artist, setArtist] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const [lastKeywords, setLastKeywords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);




  const { data } = useQuery({
    queryKey: ["studio-public"],
    queryFn: async () => {
      const [settings, categories] = await Promise.all([
        supabase
          .from("studio_settings")
          .select("studio_name, tagline, google_review_url, artists")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("review_categories")
          .select("id, name")
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      return {
        settings: settings.data,
        categories: categories.data ?? [],
      };
    },
  });

  const studioName = data?.settings?.studio_name ?? "InkPark Tattoo Studio";
  const tagline = data?.settings?.tagline ?? "Custom tattoos. Clean lines.";
  const reviewUrl = data?.settings?.google_review_url || FALLBACK_URL;
  const artistOptions = (data?.settings?.artists ?? "Avijit Saha, Sharif Uddin")
    .split(/[,\n]/)
    .map((a) => a.trim())
    .filter(Boolean);

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }


  async function run(regenerate: boolean) {
    setBusy(true);
    try {
      const result = await generate({
        data: {
          categoryIds,
          artist,
          language,
          avoid: regenerate ? review : undefined,
          avoidKeywords: regenerate ? lastKeywords : undefined,
        },
      });
      setReview(result.review);
      setLastKeywords(result.keywords ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(silent = false) {
    if (!review.trim()) return false;
    try {
      await navigator.clipboard.writeText(review);
      if (!silent) toast.success("Review copied — now paste it on Google");
      return true;
    } catch {
      toast.error("Copy failed. Select the text and copy manually.");
      return false;
    }
  }

  async function copyAndOpen() {
    const ok = await copyText(true);
    if (!ok) return;
    setCopied(true);
    window.open(reviewUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => setCopied(false), 3000);
  }


  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-12 pt-10">
      <header className="text-center">
        <h1 className="text-[22px] font-semibold leading-tight tracking-wide uppercase">
          LOVE YOUR NEW INK?
        </h1>
        <img
          src={googleReviewLogo.url}
          alt="Review us on Google"
          className="mx-auto mt-3 w-56 max-w-full"
        />
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-8 fill-[#fbbc04] text-[#fbbc04]" />
          ))}
        </div>
        <p className="mt-2 text-[15px] text-muted-foreground">Exceptional</p>
      </header>

      <section className="panel mt-8 p-5">
        <h2 className="text-lg font-medium">Leave us a review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate → Copy → Post on Google. (Takes 10 seconds.)
        </p>

        {(data?.categories.length ?? 0) > 0 && (
          <div className="mt-5">
            <p className="text-eyebrow">What stood out? (Pick Any)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ChipButton active={categoryIds.length === 0} onClick={() => setCategoryIds([])}>
                Anything
              </ChipButton>
              {data?.categories.map((c) => (
                <ChipButton
                  key={c.id}
                  active={categoryIds.includes(c.id)}
                  onClick={() => toggleCategory(c.id)}
                >
                  {c.name}
                </ChipButton>
              ))}
            </div>
          </div>
        )}

        {artistOptions.length > 0 && (
          <div className="mt-5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow">Who was your artist?</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {artistOptions.map((a) => (
                  <ChipButton
                    key={a}
                    active={artist === a}
                    onClick={() => setArtist((prev) => (prev === a ? null : a))}
                  >
                    {a}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-start">
              <p className="text-eyebrow">Language</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ChipButton active={language === "en"} onClick={() => setLanguage("en")}>
                  English
                </ChipButton>
                <ChipButton active={language === "bn"} onClick={() => setLanguage("bn")}>
                  বাংলা
                </ChipButton>
              </div>
            </div>
          </div>
        )}

        {!review ? (
          <Button
            className="mt-6 h-14 w-full rounded-full bg-primary text-base font-medium text-primary-foreground"
            onClick={() => run(false)}
            disabled={busy}
          >
            {busy ? (
              <RefreshCw className="size-5 animate-spin" />
            ) : (
              <Sparkles className="size-5" />
            )}
            {busy ? "Writing…" : "Generate review"}
          </Button>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-input bg-background p-4 text-[15px] leading-relaxed">
              {review}
            </div>

            <Button
              className="h-14 w-full rounded-full bg-primary text-base font-medium text-primary-foreground"
              onClick={copyAndOpen}
              disabled={!review.trim() || copied}
            >
              {copied ? (
                <>
                  <Check className="size-5" />
                  Copied ✓
                </>
              ) : (
                <>
                  <ExternalLink className="size-5" />
                  Copy &amp; Open Google
                </>
              )}
            </Button>

            {copied && (
              <p className="animate-in fade-in text-center text-sm text-muted-foreground">
                Review copied — paste it on Google.
              </p>
            )}
          </div>
        )}
      </section>

    </main>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-lg border border-primary bg-accent px-2.5 py-2 text-sm font-medium text-accent-foreground"
          : "rounded-lg border border-input bg-background px-2.5 py-2 text-sm font-medium text-foreground"
      }
    >
      {children}
    </button>
  );
}
