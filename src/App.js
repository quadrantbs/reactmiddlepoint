import React, { useState, useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import { Style, Icon } from 'ol/style';
import { transform } from 'ol/proj';
import axios from 'axios';
import { reverseGeocode } from 'nominatim-browser';
import pinImage from './pin.png';

function App() {
  const [map, setMap] = useState(null);
  const [features, setFeatures] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [centerCoordInv, setCenterCoordInv] = useState(null);
  const [showButton, setShowButton] = useState(false);

  function swap(arr, index1, index2) {
    const temp = arr[index1];
    arr[index1] = arr[index2];
    arr[index2] = temp;
    return arr;
  }

  useEffect(() => {
    const initialMap = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([107.6186, -6.9039]), // Center of Bandung
        zoom: 12,
      }),
    });

    setMap(initialMap);

    return () => {
      initialMap.setTarget(null);
    };
  }, []);

  useEffect(() => {
    if (map) {
      const onClick = async (event) => {
        const clickedCoord = event.coordinate;
        const transformedCoord = transform(clickedCoord, 'EPSG:3857', 'EPSG:4326');
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${transformedCoord[1]}&lon=${transformedCoord[0]}`;
        const response = await axios.get(url);
        const address = response.data.display_name;
        console.log(address, clickedCoord, transformedCoord);
        const clickedFeature = new Feature({
          geometry: new Point(clickedCoord),
          style: new Style({
            image: new Icon({
              src: pinImage,
              anchor: [0.5, 1],
              scale: 0.05,
            }),
          }),
        });
        clickedFeature.set('address', address);
        setFeatures((prevFeatures) => [...prevFeatures, clickedFeature]);
        setAddresses((prevAddresses) => [...prevAddresses, address]);

      };
      const mapClickEvent = map.on('click', onClick);
      return () => {
        unByKey(mapClickEvent);
      };

    }
  }, [map]);


  useEffect(() => {
    if (map) {
      const vectorSource = new VectorSource({
        features,
      });
      const vectorLayer = new VectorLayer({
        source: vectorSource,
      });
      map.addLayer(vectorLayer);
    }
  }, [map, features]);

  const getMiddlePoint = async () => {
    console.log(addresses.length)
    if (addresses.length > 0) {
      const coords = addresses.map((address) => {
        const url = `https://nominatim.openstreetmap.org/search/?q=${address}&format=json`;
        return axios.get(url).then((response) => {
          const { lat, lon } = response.data[0];
          return [parseFloat(lon), parseFloat(lat)];
        });
      });

      Promise.all(coords).then((transformedCoords) => {
        const totalCoords = transformedCoords.length;
        const middlePoint = transformedCoords.reduce(
          (acc, curr) => {
            return [acc[0] + curr[0], acc[1] + curr[1]];
          },
          [0, 0]
        );
        const centerCoord = [middlePoint[0] / totalCoords, middlePoint[1] / totalCoords];

        Promise.resolve().then(() => {
          console.log(centerCoord)
          const transformedCenter = transform(centerCoord, 'EPSG:4326', 'EPSG:3857');
          map.getView().animate({ center: transformedCenter, zoom: 14 });;
          const centerCoordInv = swap(centerCoord, 0, 1);
          console.log(centerCoordInv)
          setCenterCoordInv(centerCoordInv)
        });
      });
    }
    setShowButton(true);
  };

  return (
    <>
      <div id="map" style={{ width: '100%', height: '70vh' }}></div>
      <div class='container'>
        <button onClick={getMiddlePoint}>Go To Middle Point</button>
        {showButton && <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${centerCoordInv}&zoom=14`)}>
          Open In Google Maps
        </button>}
      </div>
      <ul>
        {features.map((feature, index) => (
          <li key={index}>{feature.get('address')}</li>
        ))}
      </ul>
    </>
  );
}

export default App;