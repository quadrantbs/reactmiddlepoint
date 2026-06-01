import { useState, useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { transform } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import { defaults as defaultControls, Attribution } from 'ol/control';

const useMap = (initialCenter, initialZoom, onMapClick) => {
  const [map, setMap] = useState(null);

  useEffect(() => {
    const view = new View({
      center: fromLonLat(initialCenter),
      zoom: initialZoom,
    });

    const initialMap = new Map({
      target: 'map',
      // Drop the zoom +/- and rotate buttons; keep a single, non-collapsible
      // attribution (required by the OSM tile usage policy).
      controls: defaultControls({zoom: false, rotate: false, attribution: false}).extend([
        new Attribution({collapsible: false}),
      ]),
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: view,
    });

    setMap(initialMap);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userLocation = [longitude, latitude];
          view.animate({ center: fromLonLat(userLocation), zoom: 14 });
        },
        (error) => {
          console.error("Error getting user location:", error);
        }
      );
    }

    return () => {
      initialMap.setTarget(null);
    };
    // Initialize the map once on mount; initialCenter/initialZoom are only the
    // starting view and intentionally not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map) {
      const mapClickEvent = map.on('click', (event) => {
        // Tapping an existing feature is an interaction with it (popup), not a
        // request to add a new point — skip geocoding in that case.
        if (map.hasFeatureAtPixel(event.pixel)) return;
        const clickedCoord = event.coordinate;
        const transformedCoord = transform(clickedCoord, 'EPSG:3857', 'EPSG:4326');
        onMapClick(clickedCoord, transformedCoord);
      });

      return () => {
        unByKey(mapClickEvent);
      };
    }
  }, [map, onMapClick]);

  return map;
};

export default useMap;
