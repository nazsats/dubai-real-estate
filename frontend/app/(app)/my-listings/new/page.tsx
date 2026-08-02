"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ListingForm from "@/components/ListingForm";

export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/my-listings"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> My listings
      </Link>
      <div>
        <h1 className="text-2xl font-bold">List a property</h1>
        <p className="text-sm text-slate-400">
          Fill in what you know. Everything except the description and photo is required for review.
        </p>
      </div>
      <ListingForm />
    </div>
  );
}
