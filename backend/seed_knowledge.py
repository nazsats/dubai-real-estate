"""Seed the RAG knowledge base with Dubai transaction reference material.

    python seed_knowledge.py            # load the built-in starter set
    python seed_knowledge.py --clear    # wipe shared chunks first, then load

Requires VOYAGE_API_KEY (voyageai.com) — embeddings are generated at write time.

⚠️  FIGURES CHANGE. The starter chunks below reflect widely-published Dubai
practice at the time of writing and exist so the retrieval path is testable
end to end. Fees, thresholds, and procedures are set by DLD/RERA and DO change.
Before this is used by a real agency, replace these with your own vetted
documents and keep the `source` field pointing at something auditable — a
broker quoting a stale fee to a client is exactly the failure this tool is
meant to prevent.

Add your own material by editing CHUNKS, or load a directory of markdown:
    python seed_knowledge.py --dir ./my-docs
"""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

from app.ai import knowledge
from app.db import SessionLocal

CHUNKS = [
    {
        "title": "DLD transfer fee and standard purchase costs",
        "source": "Dubai Land Department — fee schedule (verify current rates)",
        "content": (
            "The headline cost on a Dubai property purchase is the Dubai Land Department "
            "transfer fee of 4% of the purchase price. By law it is split equally between "
            "buyer and seller, but market practice in most transactions is that the buyer "
            "pays the full 4%; who actually pays is negotiable and should be stated in the "
            "MOU. On top of the transfer fee a buyer typically pays: a DLD registration "
            "(title deed issuance) fee — a few thousand dirhams, tiered by whether the "
            "price is above or below AED 500,000; a trustee office fee of roughly AED "
            "4,000 plus VAT for handling the transfer; and agency commission, "
            "conventionally 2% of the purchase price plus VAT. Budget approximately 6-7% "
            "of the purchase price in total transaction costs on a cash ready-property "
            "purchase, before any mortgage costs."
        ),
    },
    {
        "title": "Off-plan purchases, Oqood registration and escrow",
        "source": "DLD off-plan procedure (verify current rates)",
        "content": (
            "Off-plan (under-construction) property is registered differently from ready "
            "property. Instead of an immediate title deed, the sale is recorded on the "
            "Oqood system — an interim register maintained by DLD — and the buyer receives "
            "a title deed only at handover once the project is complete. The 4% DLD fee "
            "still applies and is normally paid at the time of Oqood registration. Buyer "
            "payments on off-plan projects must go into a project-specific escrow account "
            "regulated under Dubai's escrow law; developers can only draw from escrow "
            "against verified construction milestones. Before advising a client on an "
            "off-plan purchase, confirm the project and its escrow account are registered "
            "with RERA, and check the developer's delivery record on previous projects. "
            "Payment plans are set by the developer and commonly run through construction "
            "with a balloon payment at handover; post-handover payment plans spread part "
            "of the price over the years after completion."
        ),
    },
    {
        "title": "Golden Visa through property investment",
        "source": "UAE residency-by-investment rules (verify current thresholds)",
        "content": (
            "Property investment is one route to a UAE Golden Visa. The commonly cited "
            "threshold is AED 2 million in property value, which grants a ten-year "
            "renewable residence visa; the property must be retained to keep the visa "
            "valid. Investors may reach the threshold with a single property or a "
            "combination of properties, and mortgaged property can qualify subject to "
            "conditions set by the authorities regarding the amount paid. A separate, "
            "shorter residence visa exists at a lower property value. Off-plan property "
            "may qualify depending on the project's completion status and the amount paid "
            "to date. Because this is a residency matter rather than a property matter, "
            "confirm current thresholds and eligibility with the ICP or a licensed PRO "
            "before advising a client — do not quote visa eligibility from a listing "
            "portal. For a buyer whose primary motivation is residency, the visa threshold "
            "often shapes the budget more than the property preferences do."
        ),
    },
    {
        "title": "Mortgages for residents and non-residents",
        "source": "UAE Central Bank mortgage regulations (verify current caps)",
        "content": (
            "UAE mortgage lending is capped by loan-to-value limits set by the Central "
            "Bank, and the limits differ by buyer status and property value. Expatriate "
            "residents buying their first property are commonly able to borrow up to 80% "
            "of the value for properties below AED 5 million, with a lower cap above that "
            "value; UAE nationals are permitted a slightly higher ratio. Non-resident "
            "buyers face materially lower ratios and a narrower set of lenders. Off-plan "
            "purchases carry a lower cap than ready property. The buyer must fund the "
            "remaining deposit plus all transaction costs from their own funds — the "
            "mortgage cannot cover the DLD fee or commission. Banks additionally apply a "
            "debt-burden ratio limiting total monthly obligations as a share of income, "
            "and a mortgage registration fee of 0.25% of the loan amount is payable to "
            "DLD. Advise clients to obtain a pre-approval before viewing seriously: it "
            "establishes the real budget and materially strengthens an offer."
        ),
    },
    {
        "title": "Selling: NOC, service charges and the transfer appointment",
        "source": "Standard Dubai resale process (verify with the relevant developer)",
        "content": (
            "A resale transfer requires a No Objection Certificate (NOC) from the "
            "developer or master community, confirming the seller has no outstanding "
            "service charges or other dues. Developers charge a fee for the NOC — "
            "typically between AED 500 and AED 5,000 depending on the developer — and "
            "issuance can take several working days, which is the step most likely to "
            "delay a transfer. Service charges are levied per square foot annually by the "
            "owners' association and vary widely by community and building; they are a "
            "material carrying cost that buyers frequently overlook, and a high service "
            "charge can meaningfully reduce net rental yield. If the property has an "
            "existing mortgage the seller must settle it and obtain a liability letter "
            "before transfer, which adds time. The transfer itself takes place at a DLD "
            "trustee office where both parties (or their POAs) attend, the manager's "
            "cheque is handed over, and the new title deed is issued the same day."
        ),
    },
    {
        "title": "Rental market rules: RERA index, rent increases and Ejari",
        "source": "Dubai tenancy law and RERA rental index (verify current rules)",
        "content": (
            "Every Dubai tenancy contract must be registered with Ejari, the official "
            "tenancy registration system; an unregistered tenancy cannot be enforced and "
            "is needed for utility connections and residence-visa processing. Rent "
            "increases on renewal are governed by the RERA rental index, which caps the "
            "permitted increase based on how far the current rent sits below the market "
            "rate for comparable units — where the existing rent is close to market, no "
            "increase is permitted. A landlord intending to raise the rent or not renew "
            "must give the tenant written notice, conventionally 90 days before the "
            "contract ends. Eviction for the landlord's own use or to sell requires 12 "
            "months' notice served through a notary or registered mail. Disputes go to "
            "the Rental Dispute Centre. For an investor client, model the yield on the "
            "achievable rent under the index rather than the current asking rents, and "
            "subtract service charges before quoting a net figure."
        ),
    },
]


def load_dir(path: Path) -> list[dict]:
    """Load markdown/text files as chunks — one chunk per file.

    Files longer than ~6,000 characters should be split by hand into topical
    sections first: retrieval returns whole chunks, so an oversized chunk both
    dilutes the match and floods the prompt with irrelevant text.
    """
    out = []
    for f in sorted(path.rglob("*")):
        if f.suffix.lower() not in {".md", ".txt"}:
            continue
        body = f.read_text(encoding="utf-8").strip()
        if not body:
            continue
        first = body.splitlines()[0].lstrip("# ").strip()
        out.append({"title": first or f.stem, "source": f.name, "content": body})
        if len(body) > 6000:
            print(f"  ! {f.name} is {len(body):,} chars — consider splitting it")
    return out


async def main() -> None:
    chunks = list(CHUNKS)
    if "--dir" in sys.argv:
        d = Path(sys.argv[sys.argv.index("--dir") + 1])
        loaded = load_dir(d)
        print(f"loaded {len(loaded)} file(s) from {d}")
        chunks = loaded

    async with SessionLocal() as session:
        await knowledge.ensure_schema(session)
        print("schema ready (pgvector + knowledge_chunks)")

        if "--clear" in sys.argv:
            await session.execute(text("DELETE FROM knowledge_chunks WHERE agency_id IS NULL"))
            await session.commit()
            print("cleared existing shared chunks")

        try:
            n = await knowledge.add_chunks(session, chunks, agency_id=None)
        except knowledge.EmbeddingUnavailable as exc:
            print(f"\n{exc}")
            sys.exit(1)

        total = (await session.execute(text("SELECT count(*) FROM knowledge_chunks"))).scalar_one()
        print(f"embedded and stored {n} chunk(s) · knowledge_chunks now holds {total}")


if __name__ == "__main__":
    asyncio.run(main())
