"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Download, Upload, FileDown, Home, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, getToken, Property } from "@/lib/api";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function ListingsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [area, setArea] = useState("Dubai Marina");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.get<Property[]>("/api/properties?limit=48"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function importBayut() {
    setImporting(true);
    try {
      // 3 pages ≈ 75 listings city-wide; the backend keeps only the ones in
      // the requested area, so more pages = better yield for one community.
      const res = await api.post<{ imported: number; skipped: number; fetched: number }>(
        "/api/properties/import/bayut",
        { location: area, purpose: "for-sale", pages: 3 }
      );
      toast.success(`Imported ${res.imported} listings (${res.skipped} already had)`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.upload<{ imported: number; skipped: number }>(
        "/api/properties/import/csv",
        file
      );
      toast.success(`Imported ${res.imported} listings (${res.skipped} skipped)`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function downloadTemplate() {
    const res = await fetch(`${API_BASE}/api/properties/import/csv/template`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "listings_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
          <p className="text-sm text-slate-400">Your inventory + the shared market pool.</p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <Link href="/my-listings/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className="h-4 w-4" /> List a property
            </Button>
          </Link>
          <label className="w-full text-sm sm:w-auto">
            <span className="mb-1 block text-xs text-slate-400">
              Import live listings for area
            </span>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Dubai Marina, JVC"
              className="w-full sm:w-48"
            />
          </label>
          <Button onClick={importBayut} disabled={importing} variant="secondary">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Import from Bayut
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={onCsv} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} variant="secondary">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload CSV
          </Button>
          <Button onClick={downloadTemplate} variant="ghost" size="sm">
            <FileDown className="h-4 w-4" /> Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass overflow-hidden p-0">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-3 h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={Home}
            title="No listings yet"
            description="Add inventory in one of two ways: import live Dubai listings from Bayut using the button above (needs a RapidAPI key set on the backend), or upload your own agency's stock as a CSV — download the template to see the expected columns."
            actionLabel="Download CSV template"
            onAction={downloadTemplate}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
            >
              <PropertyCard p={p} size="md" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
