"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { DashboardData } from "@/lib/api";
import { aed } from "@/lib/format";

// Color by average price tier.
function priceColor(avg: number): string {
  if (avg >= 15_000_000) return "#e3b341"; // gold — ultra prime
  if (avg >= 6_000_000) return "#2dd4ff"; // brand — prime
  if (avg >= 2_500_000) return "#34d399"; // emerald — mid
  return "#a855f7"; // violet — value
}

export default function UAEMap({ markers }: { markers: DashboardData["area_markers"] }) {
  const maxCount = Math.max(1, ...markers.map((m) => m.count));

  return (
    <MapContainer
      center={[25.12, 55.23]}
      zoom={10}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap, &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {markers.map((m) => {
        const radius = 8 + (m.count / maxCount) * 22;
        const color = priceColor(m.avg_price);
        return (
          <CircleMarker
            key={m.location}
            center={[m.lat, m.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 1.5 }}
          >
            <Tooltip direction="top" opacity={1}>
              <div className="text-xs">
                <div className="font-semibold">{m.location}</div>
                <div>{m.count} listings</div>
                <div>avg {aed(m.avg_price)}</div>
                <div>~AED {m.avg_ppsf?.toLocaleString?.() ?? m.avg_ppsf}/sqft</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
