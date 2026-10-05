/** MapLibre 6 is ESM-only and needs its worker assets outside the Next bundler. */
let loading: Promise<typeof import("maplibre-gl")> | undefined;

export function loadMapLibre(): Promise<typeof import("maplibre-gl")> {
  if (!loading) {
    loading = import("maplibre-gl").then((ml) => {
      const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
      ml.setWorkerUrl(`${base}/vendor/maplibre/${ml.getVersion()}/maplibre-gl-worker.mjs`);
      return ml;
    }).catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}
