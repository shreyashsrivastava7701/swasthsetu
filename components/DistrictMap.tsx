"use client";
// Real map of Hamirpur district (OpenStreetMap), with one circle per block.
// Circle size = cases in the last 3 days. Red = Alert, amber = Watch, grey = normal.
// Leaflet only works in the browser, so it is loaded after the page opens.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { BLOCKS } from "@/lib/blocks";
import type { Cluster } from "@/lib/dashboard";

type Props = { byBlock: Record<string, number>; clusters: Cluster[] };

// Draw one circle per block.
function drawCircles(L: typeof import("leaflet"), layer: import("leaflet").LayerGroup | null, { byBlock, clusters }: Props) {
  if (!layer) return;
  layer.clearLayers();
  for (const b of BLOCKS) {
    const n = byBlock[b.name] ?? 0;
    const alert = clusters.some((c) => c.block === b.name && c.level === "alert");
    const watch = !alert && clusters.some((c) => c.block === b.name);
    const color = alert ? "#b91c1c" : watch ? "#d97706" : "#4b5563";
    L.circleMarker([b.lat, b.lng], {
      radius: 10 + Math.min(n, 20) * 1.5,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: alert || watch ? 0.35 : 0.15,
    })
      .bindTooltip(`${b.name}: ${n} case${n === 1 ? "" : "s"}${alert ? " · ALERT" : watch ? " · WATCH" : ""}`, {
        permanent: true,
        direction: "top",
      })
      .addTo(layer);
  }
}


export default function DistrictMap({ byBlock, clusters }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const latest = useRef<Props>({ byBlock, clusters });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      map.current = L.map(box.current, { scrollWheelZoom: false }).setView([31.7, 76.52], 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      drawCircles(L, layer.current, latest.current);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Redraw the circles when the numbers change.
  useEffect(() => {
    latest.current = { byBlock, clusters };
    import("leaflet").then((L) => drawCircles(L, layer.current, { byBlock, clusters }));
  }, [byBlock, clusters]);

  return <div ref={box} className="h-80 w-full overflow-hidden rounded-lg border border-gray-200" />;
}
