"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, ListingSubmission, PropertyDetail } from "@/lib/api";
import { aed } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Field, Select, Textarea } from "@/components/ui/field";

const TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse"];
const POSSESSION = ["Ready", "Under Construction", "Q4 2025", "Q1 2026", "Q2 2026", "Q3 2026"];

const EMPTY: ListingSubmission = {
  location: "",
  building: "",
  price: 0,
  type: "Apartment",
  bedrooms: 1,
  size_sqft: 0,
  bathrooms: null,
  parking: null,
  has_pool: false,
  has_gym: false,
  has_balcony: false,
  furnished: false,
  possession: "Ready",
  description: "",
  image_url: "",
  reference: "",
};

/** Client-side mirror of the backend's Field(...) constraints. Not a
 *  substitute for them — the API re-validates — but it means a typo doesn't
 *  cost a round trip and a 422 the broker has to decode. */
function validate(v: ListingSubmission): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.location.trim().length < 2) e.location = "Which community is it in?";
  if (v.building.trim().length < 2) e.building = "Building or project name is required.";
  if (!(v.price > 0)) e.price = "Enter the asking price in AED.";
  if (!(v.size_sqft > 0)) e.size_sqft = "Enter the built-up area in sqft.";
  if (v.size_sqft > 200_000) e.size_sqft = "That's larger than any Dubai unit — check the figure.";
  if (v.price > 1_000_000_000) e.price = "Check the price — that's over a billion dirhams.";
  return e;
}

export default function ListingForm({ existing }: { existing?: PropertyDetail }) {
  const router = useRouter();
  const [v, setV] = useState<ListingSubmission>(
    existing
      ? {
          location: existing.location,
          building: existing.building,
          price: existing.price,
          type: existing.type,
          bedrooms: existing.bedrooms,
          size_sqft: existing.size_sqft,
          bathrooms: existing.bathrooms ?? null,
          parking: existing.parking ?? null,
          has_pool: existing.has_pool,
          has_gym: existing.has_gym,
          has_balcony: existing.has_balcony,
          furnished: existing.furnished,
          possession: existing.possession,
          description: existing.description ?? "",
          image_url: existing.image_url ?? "",
          reference: existing.reference ?? "",
        }
      : EMPTY
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ListingSubmission>(k: K, value: ListingSubmission[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  const ppsf = v.price > 0 && v.size_sqft > 0 ? Math.round(v.price / v.size_sqft) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Check the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      // Blank optional strings are sent as null, not "" — an empty reference
      // should read as absent, not as a reference that happens to be empty.
      const payload = {
        ...v,
        description: v.description?.trim() || null,
        image_url: v.image_url?.trim() || null,
        reference: v.reference?.trim() || null,
      };
      if (existing) {
        await api.patch<PropertyDetail>(`/api/listings/${existing.id}`, payload);
        toast.success("Updated and sent back for review.");
      } else {
        await api.post<PropertyDetail>("/api/listings", payload);
        toast.success("Submitted. You'll see it live once it's verified.");
      }
      router.push("/my-listings");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save this listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-xl border border-brand/25 bg-brand/10 p-3.5 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-slate-300">
          Every submission is checked by an admin before it appears in search, on the listings grid,
          or in an AI answer.{" "}
          {existing
            ? "Editing an approved listing sends it back to the queue — the approval covered the version that was reviewed."
            : "You'll be able to track its status under My Listings."}
        </p>
      </div>

      <div className="glass space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">The property</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Building / project" required error={errors.building}>
            <Input
              value={v.building}
              onChange={(e) => set("building", e.target.value)}
              placeholder="e.g. Marina Gate 2"
            />
          </Field>
          <Field label="Community" required error={errors.location} hint="Use the name buyers search for.">
            <Input
              value={v.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Dubai Marina"
            />
          </Field>
          <Field label="Type" required>
            <Select value={v.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Handover" required>
            <Select value={v.possession} onChange={(e) => set("possession", e.target.value)}>
              {POSSESSION.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="glass space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Price &amp; size</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Asking price (AED)"
            required
            error={errors.price}
            hint={v.price > 0 ? aed(v.price, false) : undefined}
          >
            <Input
              type="number"
              min={0}
              value={v.price || ""}
              onChange={(e) => set("price", Number(e.target.value))}
              placeholder="2400000"
            />
          </Field>
          <Field
            label="Built-up area (sqft)"
            required
            error={errors.size_sqft}
            hint={ppsf ? `AED ${ppsf.toLocaleString()}/sqft` : undefined}
          >
            <Input
              type="number"
              min={0}
              value={v.size_sqft || ""}
              onChange={(e) => set("size_sqft", Number(e.target.value))}
              placeholder="1250"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bedrooms" required hint="0 for a studio">
            <Input
              type="number"
              min={0}
              max={20}
              value={v.bedrooms}
              onChange={(e) => set("bedrooms", Number(e.target.value))}
            />
          </Field>
          <Field label="Bathrooms">
            <Input
              type="number"
              min={0}
              max={20}
              value={v.bathrooms ?? ""}
              onChange={(e) => set("bathrooms", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
          <Field label="Parking bays">
            <Input
              type="number"
              min={0}
              max={20}
              value={v.parking ?? ""}
              onChange={(e) => set("parking", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      <div className="glass space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Features</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Check label="Pool" checked={v.has_pool} onChange={(b) => set("has_pool", b)} />
          <Check label="Gym" checked={v.has_gym} onChange={(b) => set("has_gym", b)} />
          <Check label="Balcony" checked={v.has_balcony} onChange={(b) => set("has_balcony", b)} />
          <Check label="Furnished" checked={v.furnished} onChange={(b) => set("furnished", b)} />
        </div>
      </div>

      <div className="glass space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Listing detail</h2>
        <Field
          label="Description"
          hint="What a buyer should know: view, floor, layout, service charge, why it's worth the ask."
        >
          <Textarea
            value={v.description ?? ""}
            maxLength={4000}
            rows={6}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Corner unit on the 24th floor with unobstructed marina views…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Photo URL" hint="A direct link to a hosted image.">
            <Input
              type="url"
              value={v.image_url ?? ""}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Your reference" hint="Your own internal listing code, if you use one.">
            <Input
              value={v.reference ?? ""}
              maxLength={64}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="e.g. NZ-1042"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {existing ? "Resubmit for review" : "Submit for verification"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
