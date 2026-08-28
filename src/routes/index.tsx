import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, RefreshCw, Sparkles, Star, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { generateReview } from "@/lib/review.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const generate = useServerFn(generateReview);
  const [review, setReview] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [artist, setArtist] = useState<string | null>(null);

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
    setCopied(false);
    try {
      const result = await generate({
        data: { categoryId, avoid: regenerate ? review : undefined },
      });
      setReview(result.review);
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(review);
      setCopied(true);
      toast.success("Review copied — now paste it on Google");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Copy failed. Select the text and copy manually.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-12 pt-10">
      <header className="text-center">
        <p className="text-eyebrow">Tattoo Studio</p>
        <h1 className="mt-2 text-5xl leading-none uppercase">{studioName}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{tagline}</p>
        <div className="mt-4 flex justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4 fill-foreground text-foreground" />
          ))}
        </div>
      </header>

      <section className="panel mt-8 p-5">
        <h2 className="text-2xl uppercase">Leave us a review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap generate, tweak the words if you like, copy it and post it on Google. Takes about
          ten seconds.
        </p>

        {(data?.categories.length ?? 0) > 0 && (
          <div className="mt-5">
            <p className="text-eyebrow">What stood out? (pick any)</p>
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
          <div className="mt-5">
            <p className="text-eyebrow">Who was your artist?</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
        )}


        {!review ? (
          <Button
            className="mt-6 h-14 w-full text-base font-semibold uppercase tracking-wide"
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
            {editing ? (
              <Textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={6}
                autoFocus
                className="resize-none bg-secondary text-base leading-relaxed"
              />
            ) : (
              <div className="rounded-lg border border-hairline bg-secondary p-4 text-[15px] leading-relaxed">
                {review}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12 uppercase"
                onClick={() => run(true)}
                disabled={busy}
              >
                <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
                Regenerate
              </Button>
              <Button
                variant="outline"
                className="h-12 uppercase"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil className="size-4" />
                {editing ? "Done" : "Edit"}
              </Button>
            </div>

            <Button
              className="h-14 w-full text-base font-semibold uppercase tracking-wide"
              onClick={copy}
              disabled={!review.trim()}
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
              {copied ? "Copied" : "Copy review"}
            </Button>

            <Button
              variant="secondary"
              className="h-14 w-full text-base font-semibold uppercase tracking-wide"
              asChild
            >
              <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-5" />
                Open Google Reviews
              </a>
            </Button>

            <p className="pt-1 text-center text-xs text-muted-foreground">
              Nothing is posted automatically — you paste and submit it yourself.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-10 text-center">
        <Link to="/admin" className="text-xs uppercase tracking-widest text-muted-foreground">
          Studio admin
        </Link>
      </footer>
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
          ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
          : "rounded-full border border-input px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      }
    >
      {children}
    </button>
  );
}
