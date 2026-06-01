// External service endpoints used across the app.
export const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
// Overpass mirrors, tried in order — the main instance often returns 504 when busy.
export const OVERPASS_API_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
export const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

// localStorage key for persisting added addresses across reloads.
export const ADDRESSES_STORAGE_KEY = "middlepoint:addresses";
