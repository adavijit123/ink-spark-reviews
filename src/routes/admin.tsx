import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Studio Admin — InkPark Tattoo Studio" },
      {
        name: "description",
        content:
          "Manage InkPark review presets, studio keywords, AI instructions and review categories.",
      },
      { property: "og:title", content: "Studio Admin — InkPark Tattoo Studio" },
      { property: "og:description", content: "Configure the InkPark AI review generator." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    supabase.rpc("claim_admin").then(({ data, error }) => {
      if (error) toast.error(error.message);
      setIsAdmin(Boolean(data));
    });
  }, [session]);

  if (!ready) return <Shell>Loading…</Shell>;
  if (!session) return <SignIn />;
  if (!isAdmin)
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          This account does not have admin access. Ask the studio owner to grant it.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </Shell>
    );

  return <AdminDashboard />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-4xl uppercase">Studio admin</h1>
      <div className="panel mt-6 p-5">{children}</div>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground"
      >
        <ArrowLeft className="size-3" /> Review page
      </Link>
    </main>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/admin` },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) toast.error(error.message);
    else if (mode === "up") toast.success("Account created. You can sign in now.");
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1.5"
          />
        </div>
        <Button type="submit" className="h-12 w-full uppercase" disabled={busy}>
          {mode === "in" ? "Sign in" : "Create admin account"}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="w-full text-xs uppercase tracking-widest text-muted-foreground"
        >
          {mode === "in" ? "First time? Create the admin account" : "Have an account? Sign in"}
        </button>
      </form>
    </Shell>
  );
}

type Settings = {
  id: string;
  studio_name: string;
  tagline: string;
  google_review_url: string;
  studio_info: string;
  services: string;
  artists: string;
  experience_keywords: string;
  ai_instructions: string;
  artist_mention_percent: number;
  bangla_percent: number;
};

type Category = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

type Preset = {
  id: string;
  category_id: string | null;
  content: string;
  tone: string;
  sort_order: number;
  is_active: boolean;
  bangla_percent: number | null;
};

type Keyword = {
  id: string;
  keyword: string;
  weight_percent: number;
  is_active: boolean;
  sort_order: number;
};

function AdminDashboard() {
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const presetsQuery = useQuery({
    queryKey: ["admin", "presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_presets")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Preset[];
    },
  });

  const keywordsQuery = useQuery({
    queryKey: ["admin", "keywords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_keywords")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Keyword[];
    },
  });

  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: ["admin", key] });

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-eyebrow">InkPark</p>
          <h1 className="text-4xl uppercase leading-none">Studio admin</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          <LogOut className="size-4" />
        </Button>
      </div>

      <Tabs defaultValue="presets" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="categories">Angles</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="studio">Studio</TabsTrigger>
        </TabsList>


        <TabsContent value="presets" className="mt-4">
          <PresetsPanel
            presets={presetsQuery.data ?? []}
            categories={categoriesQuery.data ?? []}
            onChanged={() => invalidate("presets")}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesPanel
            categories={categoriesQuery.data ?? []}
            onChanged={() => invalidate("categories")}
          />
        </TabsContent>

        <TabsContent value="keywords" className="mt-4">
          <KeywordsPanel
            keywords={keywordsQuery.data ?? []}
            onChanged={() => invalidate("keywords")}
          />
        </TabsContent>

        <TabsContent value="studio" className="mt-4">
          <StudioPanel settings={settingsQuery.data ?? null} onChanged={() => invalidate("settings")} />
        </TabsContent>
      </Tabs>

      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground"
      >
        <ArrowLeft className="size-3" /> Review page
      </Link>
    </main>
  );
}

function PresetsPanel({
  presets,
  categories,
  onChanged,
}: {
  presets: Preset[];
  categories: Category[];
  onChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [tone, setTone] = useState("friendly");
  const [categoryId, setCategoryId] = useState<string>("");
  const [bangla, setBangla] = useState<string>("");

  async function add() {
    if (!content.trim()) return;
    const parsed = bangla.trim() === "" ? null : Math.min(100, Math.max(0, Number(bangla)));
    const { error } = await supabase.from("review_presets").insert({
      content: content.trim(),
      tone: tone.trim() || "friendly",
      category_id: categoryId || null,
      sort_order: presets.length + 1,
      bangla_percent: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setContent("");
    setBangla("");
    onChanged();
    toast.success("Preset added");
  }

  async function toggle(preset: Preset) {
    const { error } = await supabase
      .from("review_presets")
      .update({ is_active: !preset.is_active })
      .eq("id", preset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  async function setBanglaPercent(preset: Preset, value: string) {
    const parsed = value.trim() === "" ? null : Math.min(100, Math.max(0, Number(value)));
    const { error } = await supabase
      .from("review_presets")
      .update({ bangla_percent: parsed !== null && Number.isFinite(parsed) ? parsed : null })
      .eq("id", preset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("review_presets").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
    toast.success("Preset removed");
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <p className="text-eyebrow">New preset idea</p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="e.g. The artist explained every step and the healing was perfect."
          className="mt-2 resize-none bg-secondary"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Tone" />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-9 rounded-md border border-input bg-secondary px-2 text-sm"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <Label className="text-eyebrow">Bangla share for this preset (%) — blank = studio default</Label>
          <Input
            value={bangla}
            inputMode="numeric"
            placeholder="e.g. 25"
            onChange={(e) => setBangla(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="mt-3 w-full uppercase" onClick={add}>
          <Plus className="size-4" /> Add preset
        </Button>
      </div>

      {presets.map((p) => (
        <div key={p.id} className="panel p-4">
          <p className="text-sm leading-relaxed">{p.content}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Bangla %
            </span>
            <Input
              defaultValue={p.bangla_percent ?? ""}
              inputMode="numeric"
              placeholder="default"
              onBlur={(e) => setBanglaPercent(p, e.target.value)}
              className="h-8 w-24"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {categories.find((c) => c.id === p.category_id)?.name ?? "No category"} · {p.tone}
            </span>
            <div className="flex items-center gap-3">
              <Switch checked={p.is_active} onCheckedChange={() => toggle(p)} />
              <button onClick={() => remove(p.id)} aria-label="Delete preset">
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {presets.length === 0 && (
        <p className="text-sm text-muted-foreground">No presets yet.</p>
      )}
    </div>
  );
}

function CategoriesPanel({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("review_categories").insert({
      name: name.trim(),
      description: description.trim(),
      sort_order: categories.length + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setDescription("");
    onChanged();
    toast.success("Category added");
  }

  async function toggle(category: Category) {
    const { error } = await supabase
      .from("review_categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("review_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <p className="text-eyebrow">New category</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          className="mt-2"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this angle is about"
          className="mt-2"
        />
        <Button className="mt-3 w-full uppercase" onClick={add}>
          <Plus className="size-4" /> Add category
        </Button>
      </div>

      {categories.map((c) => (
        <div key={c.id} className="panel flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} />
            <button onClick={() => remove(c.id)} aria-label="Delete category">
              <Trash2 className="size-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function KeywordsPanel({
  keywords,
  onChanged,
}: {
  keywords: Keyword[];
  onChanged: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [weight, setWeight] = useState("40");

  async function add() {
    if (!keyword.trim()) return;
    const parsed = Math.min(100, Math.max(0, Number(weight) || 0));
    const { error } = await supabase.from("review_keywords").insert({
      keyword: keyword.trim(),
      weight_percent: parsed,
      sort_order: keywords.length + 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setKeyword("");
    onChanged();
    toast.success("Keyword added");
  }

  async function update(id: string, patch: Partial<Keyword>) {
    const { error } = await supabase.from("review_keywords").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("review_keywords").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <p className="text-eyebrow">New keyword</p>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. Best tattoo studio in dhaka"
          className="mt-2"
        />
        <div className="mt-2">
          <Label className="text-eyebrow">Appears in % of reviews</Label>
          <Input
            value={weight}
            inputMode="numeric"
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <Button className="mt-3 w-full uppercase" onClick={add}>
          <Plus className="size-4" /> Add keyword
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Max 2 keywords per review, and a regenerated review never repeats the same combination.
        </p>
      </div>

      {keywords.map((k) => (
        <div key={k.id} className="panel p-4">
          <p className="text-sm font-semibold">{k.keyword}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Input
                defaultValue={k.weight_percent}
                inputMode="numeric"
                onBlur={(e) =>
                  update(k.id, {
                    weight_percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="h-8 w-20"
              />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                % of reviews
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={k.is_active}
                onCheckedChange={(v) => update(k.id, { is_active: v })}
              />
              <button onClick={() => remove(k.id)} aria-label="Delete keyword">
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      ))}
      {keywords.length === 0 && <p className="text-sm text-muted-foreground">No keywords yet.</p>}
    </div>
  );
}

function StudioPanel({
  settings,
  onChanged,
}: {
  settings: Settings | null;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<Omit<Settings, "id"> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      const { id: _id, ...rest } = settings;
      setForm(rest);
    }
  }, [settings]);

  if (!settings || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (key: keyof Omit<Settings, "id">) => (value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const setNumber = (key: "artist_mention_percent" | "bangla_percent") => (value: string) =>
    setForm((f) =>
      f ? { ...f, [key]: Math.min(100, Math.max(0, Number(value) || 0)) } : f,
    );

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("studio_settings").update(form!).eq("id", settings!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
    toast.success("Saved");
  }

  return (
    <div className="panel space-y-4 p-4">
      <Field label="Studio name" value={form.studio_name} onChange={set("studio_name")} />
      <Field label="Tagline" value={form.tagline} onChange={set("tagline")} />
      <Field
        label="Google review URL"
        value={form.google_review_url}
        onChange={set("google_review_url")}
      />
      <Field
        label="Studio information"
        value={form.studio_info}
        onChange={set("studio_info")}
        multiline
      />
      <Field label="Services" value={form.services} onChange={set("services")} multiline />
      <Field label="Artists" value={form.artists} onChange={set("artists")} multiline />
      <Field
        label="Experience keywords (comma separated)"
        value={form.experience_keywords}
        onChange={set("experience_keywords")}
        multiline
      />
      <Field
        label="Artist name appears in % of reviews"
        value={String(form.artist_mention_percent)}
        onChange={setNumber("artist_mention_percent")}
      />
      <Field
        label="Bangla reviews (% — default when a preset has none)"
        value={String(form.bangla_percent)}
        onChange={setNumber("bangla_percent")}
      />
      <Field
        label="AI generation instructions"
        value={form.ai_instructions}
        onChange={set("ai_instructions")}
        multiline
        rows={6}
      />
      <Button className="h-12 w-full uppercase" onClick={save} disabled={busy}>
        <Save className="size-4" /> Save changes
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <Label className="text-eyebrow">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 resize-none bg-secondary"
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5" />
      )}
    </div>
  );
}

function StatsPanel() {
  const eventsQuery = useQuery({
    queryKey: ["review-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("review_events")
        .select("id, event_type, session_id, rating, email, language, artist, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = eventsQuery.data ?? [];
  const scans = new Set(
    events.filter((e) => e.event_type === "page_view").map((e) => e.session_id ?? e.id),
  ).size;
  const generated = events.filter((e) => e.event_type === "generate").length;
  const opened = new Set(
    events.filter((e) => e.event_type === "copy_open").map((e) => e.session_id ?? e.id),
  ).size;
  const confirms = events.filter((e) => e.event_type === "confirm");
  const rated = confirms.filter((e) => e.rating);
  const avg = rated.length
    ? (rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="QR scans / visits" value={scans} />
        <StatCard label="Reviews generated" value={generated} />
        <StatCard label="Opened Google" value={opened} />
        <StatCard label="Avg. stars given" value={avg} />
      </div>

      <div className="panel p-4">
        <p className="text-eyebrow">Confirmed reviews</p>
        {confirms.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No customer confirmations yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {confirms.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-input px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.email || "No email shared"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                    {e.artist ? ` · ${e.artist}` : ""}
                    {e.language ? ` · ${e.language.toUpperCase()}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-medium">
                  {e.rating ? `${e.rating}★` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Google does not share reviewer email addresses or star ratings with third-party
        apps, so ratings and emails here are what customers voluntarily share after
        posting.
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="panel p-4">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
