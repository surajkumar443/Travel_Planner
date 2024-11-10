import { renderHeader } from "./shared/header.js";

renderHeader();
getLocations();

async function getLocations() {
  let response = await fetch(`/api/locations/`);
  let locations = await response.json();  
  console.log(locations);
  
  let itineraryHtml = "";

  for (let continent in locations) {
    itineraryHtml += `<h1>${continent}</h1>`;
    itineraryHtml += `<div class="itinerary-grid">`;
    for (let location of locations[continent]){
      itineraryHtml += 
        `<a class="itinerary-detail-link" href='/itinerary-detail?destination=${encodeURIComponent(location.city[0])},${encodeURIComponent(location.place)}&duration=${encodeURIComponent(location.duration)}'>
          <div class="itinerary-preview">
            <div class="thumbnail-row">
              <img class="thumbnail-photo" src=${location.img}>
              <p class="thumbnail-intro">${location.place}</p>
              <div class="trip-duration">${location.duration}</div>
            </div>
            <div class="trip-info">
              <p>${location.city.join(' | ')}</p>
            </div>
          </div>
        </a>`;
    };

    itineraryHtml += `</div>`;

  }

  document.querySelector('.main-home').innerHTML=itineraryHtml;
}



console.log("Home page loaded");