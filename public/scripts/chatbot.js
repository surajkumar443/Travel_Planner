import { renderHeader } from "./shared/header.js";
import * as map from "./modules/map.js";

renderHeader();
initializeMap();

/* ******** MAP CONTROLLER ******** */
async function initializeMap() {
  const destination=decodeURIComponent(new URLSearchParams(window.location.search).get("destination"));
  if (destination) {
    try {
      const { lat, lng } = await map.getLatLngFromAddress(destination);
      await map.initMap({ lat, lng });
    } catch (error) {
      console.log(error);
      //default location
      await map.initMap({ lat: 61.2181, lng: -149.9003 });
    }
  } else {
    await map.initMap({ lat: 61.2181, lng: -149.9003 });
  }
}