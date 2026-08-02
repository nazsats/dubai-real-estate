"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { api, ApiError, PropertyDetail } from "@/lib/api";
import ListingForm from "@/components/ListingForm";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<PropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PropertyDetail>(`/api/listings/${id}`)
      .then(setP)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Could not load this listing")
      );
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/my-listings"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> My listings
      </Link>

      {error ? (
        <div className="glass">
          <EmptyState
            icon={AlertTriangle}
            title="Can't edit this listing"
            description={`${error} You can only edit listings you submitted yourself.`}
          />
        </div>
      ) : !p ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold">Edit {p.building}</h1>
            <p className="text-sm text-slate-400">
              {p.status === "rejected"
                ? "Fix what the reviewer flagged, then resubmit."
                : "Changes go back through verification before they go live."}
            </p>
          </div>
          {p.status === "rejected" && p.rejection_reason && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm">
              <span className="font-medium text-red-300">Reviewer said: </span>
              <span className="text-slate-300">{p.rejection_reason}</span>
            </div>
          )}
          <ListingForm existing={p} />
        </>
      )}
    </div>
  );
}
