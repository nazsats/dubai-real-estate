"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { DashboardData } from "@/lib/api";
import { aed, num } from "@/lib/format";
import { STAGE_RAMP, STATUS } from "@/lib/viz";

/**
 * Price band → colour.
 *
 * Price bands are ORDERED, so they use the ordinal ramp (deepening with price).
 * The top band keeps a warm accent so "ultra prime" stands out against the
 * cool ramp.
 */
function priceColor(avg: number): string {
  if (avg >= 15_000_000) return STATUS.warning; // ultra prime
  if (avg >= 6_000_000) return STAGE_RAMP[4]; // prime
  if (avg >= 2_500_000) return STAGE_RAMP[3]; // mid
  return STAGE_RAMP[1]; // value
}

export default function UAEMap({ markers }: { markers: DashboardData["area_markers"] }) {
  const maxCount = Math.max(1, ...markers.map((m) => m.count));

  return (
    <MapContainer
      center={[25.11, 55.2]}
      zoom={11}
      minZoom={9}
      maxZoom={14}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap, &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {markers.map((m) => {
        // sqrt scaling so the circle's AREA tracks inventory — linear radius
        // exaggerates big areas (a 4x inventory looked 16x the size).
        const radius = 9 + 24 * Math.sqrt(m.count / maxCount);
        const color = priceColor(m.avg_price);
        return (
          <CircleMarker
            key={m.location}
            center={[m.lat, m.lng]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.4,
              weight: 1.5,
              // dark ring separates overlapping circles (Marina/JBR/JLT cluster)
              fillRule: "nonzero",
            }}
            eventHandlers={{
              mouseover: (e) => e.target.setStyle({ fillOpacity: 0.65, weight: 2.5 }),
              mouseout: (e) => e.target.setStyle({ fillOpacity: 0.4, weight: 1.5 }),
            }}
          >
            <Tooltip direction="top" opacity={1}>
              <div className="text-xs leading-relaxed">
                <div className="text-[13px] font-bold">{m.location}</div>
                <div className="mt-0.5 grid grid-cols-2 gap-x-3">
                  <span className="text-slate-400">Listings</span>
                  <span className="text-right font-semibold">{num(m.count)}</span>
                  <span className="text-slate-400">Avg price</span>
                  <span className="text-right font-semibold">{aed(m.avg_price)}</span>
                  <span className="text-slate-400">Per sqft</span>
                  <span className="text-right font-semibold">AED {num(Math.round(m.avg_ppsf))}</span>
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
