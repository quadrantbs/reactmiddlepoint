import {useState, useCallback, useMemo} from "react";
import axios from "axios";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Circle from "ol/geom/Circle";
import {Style, Circle as CircleStyle, Stroke, Fill} from "ol/style";
import {fromLonLat, transform} from "ol/proj";
import {swap, haversineMeters} from "../utils";
import {OVERPASS_API_URLS} from "../constants";

const INITIAL_VISIBLE = 5; // how many recommendations to show first
const MORE_STEP = 5; // how many more per "Show more" click
const MIN_RECOMMENDATIONS = 3; // auto-expand radius until at least this many found
const CANDIDATE_LIMIT = 120; // candidate pool size pulled from Overpass
const MAX_AUTO_RADIUS = 16000; // metres — stop expanding here

const createRecommendationFeature = (place, uid) => {
  const feature = new Feature({geometry: new Point(fromLonLat([place.lon, place.lat]))});
  feature.set("uid", uid);
  feature.set("type", "recommendation");
  feature.set("label", place.name);
  feature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({color: "#dc3545"}),
        stroke: new Stroke({color: "#fff", width: 2}),
      }),
    }),
  );
  return feature;
};

const createMiddleCircle = (center, radius, uid) => {
  const feature = new Feature(new Circle(center, radius));
  feature.set("uid", uid);
  feature.set("type", "middle");
  feature.setStyle(
    new Style({
      stroke: new Stroke({color: "rgba(0,123,255,0.9)", width: 3, lineDash: [6, 6]}),
      fill: new Fill({color: "rgba(0,123,255,0.12)"}),
    }),
  );
  return feature;
};

// Average the address coordinates (in lon/lat) to find the centroid.
const computeCentroid = (addressFeatures) => {
  const coords = addressFeatures.map((f) =>
    transform(f.getGeometry().getCoordinates(), "EPSG:3857", "EPSG:4326"),
  );
  const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
  return [sum[0] / coords.length, sum[1] / coords.length];
};

// POST the query to each Overpass mirror in turn, returning the first success.
const overpassRequest = async (query) => {
  let lastErr;
  for (const url of OVERPASS_API_URLS) {
    try {
      const {data} = await axios.post(url, query, {timeout: 30000});
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
};

// Returns ALL named POIs within `radius`, deduped by name and sorted by distance
// to the (lat, lon) middle point — nearest first.
const fetchRecommendations = async (lat, lon, radius) => {
  // `[timeout:25]` bounds server-side execution; only named POIs are requested
  // (`nwr[...][name]`) to keep the result small enough to avoid 504 timeouts.
  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr["amenity"~"restaurant|cafe|fast_food|bar|pub|food_court"]["name"](around:${radius},${lat},${lon});
      nwr["leisure"~"park|garden"]["name"](around:${radius},${lat},${lon});
      nwr["shop"~"supermarket|bakery|convenience|mall|department_store"]["name"](around:${radius},${lat},${lon});
      nwr["tourism"~"hotel|attraction|museum"]["name"](around:${radius},${lat},${lon});
    );
    out center ${CANDIDATE_LIMIT};
  `;
  const data = await overpassRequest(overpassQuery);
  const elements = data.elements || [];

  const byName = new Map();
  elements.forEach((el) => {
    if (!el.tags?.name) return;
    // Nodes carry lat/lon directly; ways/relations carry it under `center`.
    const plat = el.lat ?? el.center?.lat;
    const plon = el.lon ?? el.center?.lon;
    if (plat == null || plon == null) return;
    const dist = haversineMeters([lat, lon], [plat, plon]);
    const existing = byName.get(el.tags.name);
    if (!existing || dist < existing.dist) {
      byName.set(el.tags.name, {name: el.tags.name, lat: plat, lon: plon, dist});
    }
  });
  return [...byName.values()].sort((a, b) => a.dist - b.dist);
};

const overpassErrorMessage = (err, fallback) => {
  const status = err?.response?.status;
  return status === 504 || status === 429 || err?.code === "ECONNABORTED"
    ? "Recommendation service is busy right now — please try again in a moment."
    : fallback;
};

// Computes the centroid of the given address features, animates the map there,
// and fetches nearby meet-up-friendly places from Overpass. Keeps the full
// candidate pool so the user can reveal more (widening the radius when needed).
export default function useRecommendations(map, addressFeatures, radius, onRadiusChange) {
  const [allPlaces, setAllPlaces] = useState([]); // full sorted pool at effectiveRadius
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [effectiveRadius, setEffectiveRadius] = useState(radius);
  const [centerCoordInv, setCenterCoordInv] = useState(null); // [lat, lon]
  const [isFetchingPlaces, setIsFetchingPlaces] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [error, setError] = useState(null);

  const recommendedPlaces = useMemo(
    () => allPlaces.slice(0, visibleCount),
    [allPlaces, visibleCount],
  );

  // Recommendation markers (deterministic uid by name) + the search-area circle.
  const recommendationFeatures = useMemo(() => {
    if (!centerCoordInv) return [];
    const feats = recommendedPlaces.map((p) => createRecommendationFeature(p, `rec-${p.name}`));
    const transformedCenter = fromLonLat([centerCoordInv[1], centerCoordInv[0]]);
    feats.push(createMiddleCircle(transformedCenter, effectiveRadius, "middle-circle"));
    return feats;
  }, [recommendedPlaces, centerCoordInv, effectiveRadius]);

  // More is possible if the pool still has hidden places, or we can widen further.
  const canLoadMore =
    recommendedPlaces.length > 0 &&
    (allPlaces.length > visibleCount || effectiveRadius < MAX_AUTO_RADIUS);

  const getMiddlePoint = useCallback(async () => {
    if (addressFeatures.length === 0) return;

    const centerCoord = computeCentroid(addressFeatures);
    const transformedCenter = transform(centerCoord, "EPSG:4326", "EPSG:3857");
    if (map) map.getView().animate({center: transformedCenter, zoom: 14});

    const [lat, lon] = swap(centerCoord, 0, 1);

    setIsFetchingPlaces(true);
    setNoResults(false);
    setError(null);
    try {
      // Auto-expand (doubling) until we find at least MIN_RECOMMENDATIONS.
      let eff = radius;
      let places = await fetchRecommendations(lat, lon, eff);
      while (places.length < MIN_RECOMMENDATIONS && eff < MAX_AUTO_RADIUS) {
        eff = Math.min(eff * 2, MAX_AUTO_RADIUS);
        places = await fetchRecommendations(lat, lon, eff);
      }

      setCenterCoordInv([lat, lon]);
      setEffectiveRadius(eff);
      setAllPlaces(places);
      setVisibleCount(INITIAL_VISIBLE);
      setNoResults(places.length === 0);
      if (eff !== radius && onRadiusChange) onRadiusChange(eff);
    } catch (err) {
      console.error("Error fetching recommendations from Overpass API:", err);
      setError(overpassErrorMessage(err, "Error fetching recommended places. Please try again."));
    } finally {
      setIsFetchingPlaces(false);
    }
  }, [map, addressFeatures, radius, onRadiusChange]);

  const loadMore = useCallback(async () => {
    // Reveal more from the pool we already have.
    if (allPlaces.length > visibleCount) {
      setVisibleCount((v) => v + MORE_STEP);
      return;
    }
    // Pool exhausted — widen the search radius one step and fetch more.
    if (effectiveRadius >= MAX_AUTO_RADIUS || !centerCoordInv) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const [lat, lon] = centerCoordInv;
      const eff = Math.min(effectiveRadius * 2, MAX_AUTO_RADIUS);
      const places = await fetchRecommendations(lat, lon, eff);
      setEffectiveRadius(eff);
      if (onRadiusChange) onRadiusChange(eff);
      setAllPlaces(places);
      if (places.length > allPlaces.length) {
        setVisibleCount((v) => Math.min(v + MORE_STEP, places.length));
      }
      // If no new places appeared, the wider circle is shown and the user can
      // click again to widen further (until MAX_AUTO_RADIUS).
    } catch (err) {
      console.error("Error loading more recommendations:", err);
      setError(overpassErrorMessage(err, "Error loading more places. Please try again."));
    } finally {
      setIsLoadingMore(false);
    }
  }, [allPlaces, visibleCount, effectiveRadius, centerCoordInv, onRadiusChange]);

  const clear = useCallback(() => {
    setAllPlaces([]);
    setVisibleCount(INITIAL_VISIBLE);
    setCenterCoordInv(null);
    setNoResults(false);
    setError(null);
  }, []);

  return {
    recommendedPlaces,
    recommendationFeatures,
    centerCoordInv,
    isFetchingPlaces,
    isLoadingMore,
    canLoadMore,
    noResults,
    error,
    getMiddlePoint,
    loadMore,
    clear,
  };
}
