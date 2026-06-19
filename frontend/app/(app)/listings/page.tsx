"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, Upload, FileDown, BedDouble, Maximize, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api, API_BASE, getToken, Property } from "@/lib/api";
import { aed } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
      const res = await api.post<{ imported: number; skipped: number; fetched: number }>(
        "/api/properties/import/bayut",
        { location: area, purpose: "for-sale", pages: 1 }
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
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-400">Import area (Bayut)</span>
            <Input value={area} onChange={(e) => setArea(e.target.value)} className="w-44" />
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
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass p-10 text-center text-slate-400">
          No listings yet. Import real ones from Bayut above (needs a RapidAPI key in the backend).
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="glass card-hover overflow-hidden p-0"
            >
              <div className="relative h-44 w-full overflow-hidden bg-ink-700">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.building} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    <MapPin className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  <Badge variant="muted">{p.type}</Badge>
                  {p.source === "bayut" && <Badge variant="gold">Live</Badge>}
                </div>
                <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-sm font-bold text-brand backdrop-blur">
                  {aed(p.price)}
                </div>
              </div>
              <div className="p-4">
                <div className="truncate font-semibold" title={p.building}>
                  {p.building}
                </div>
                <div className="flex items-center gap-1 truncate text-xs text-slate-400">
                  <MapPin className="h-3 w-3" /> {p.location}
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" /> {p.bedrooms || "Studio"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize className="h-3.5 w-3.5" /> {p.size_sqft ? `${p.size_sqft.toLocaleString()} sqft` : "—"}
                  </span>
                  <span className="ml-auto text-slate-500">{p.possession}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
