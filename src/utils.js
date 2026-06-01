export function swap(arr, index1, index2) {
  const copy = [...arr];
  [copy[index1], copy[index2]] = [copy[index2], copy[index1]];
  return copy;
}

// Unique id helper (avoids relying on array length, which can collide after removals).
export const makeUid = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Great-circle distance between two [lat, lon] points, in meters.
export function haversineMeters([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Human-friendly distance string, e.g. "320 m" or "1.4 km".
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
