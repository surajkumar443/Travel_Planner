let map;
let places={};
let markers={};
export let types=[];
const PLACE_TYPES = {
  see: "tourist_attraction",
  dining: "restaurant",
  cafe: "cafe",
  bar: "bar",
  hotel: "lodging",
  mall: "shopping_mall",
};

const defaultTypes=Object.keys(PLACE_TYPES);

//Map initialization
export async function initMap(center) {
  const { Map } = await google.maps.importLibrary("maps");
  map = new Map(document.getElementById("map"), {
    center: center,
    zoom: 12,
    gestureHandling: 'greedy',
    mapId: '6a6872677ff3e032'
  });
  return map;
}

// Attach dragend event listener
export function attachDragendListener(map, getTypes) {
  map.addListener("dragend", async ()=>{
    const newCenter=map.getCenter().toJSON();
    clearMarkers();
    clearAllPlaceCards();
    clearPlaces();
    const types=getTypes();
    for (let type of defaultTypes){
      const results=await nearbySearch(newCenter, 6000, PLACE_TYPES[type]);
      if (results){
        results.forEach((result)=>savePlace(result, type));
      }
    }
    for (let type of types){
      addMarker(type);
      createPlaceCard(type);
    }
    updatePlaceNumber(types);
  });
}

//Function to get lat and lng from address
export async function getLatLngFromAddress(address) {
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) {
        const { lat, lng } = results[0].geometry.location;
        resolve({ lat: lat(), lng: lng() });
      } else {
        reject(
          "Geocode was not successful for the following reason: " + status,
        );
      }
    });
  });
}

//Search for nearby locations on the map based on type
export async function nearbySearch(center,radius,type) {
  const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");
  const request = {
    // required parameters
    fields: ["displayName", "location", "businessStatus", "photos", "rating",	"svgIconMaskURI", "iconBackgroundColor", "userRatingCount", "addressComponents"],
    locationRestriction: {
      center: center,
      radius: radius,
    },
    // optional parameters
    includedPrimaryTypes: [type],
    maxResultCount: 15,
    rankPreference: SearchNearbyRankPreference.POPULARITY,
  };
  let results = await Place.searchNearby(request);
  results= results.places;
  if(results.length){
    return results;
  }
}

//Add markers for all location with matching type tDao the map
export async function addMarker(type){
  const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
  if(places[type]){
    places[type].forEach((place)=>{
      const pinElement = new PinElement({
        background: place.iconBackgroundColor,
        glyph: new URL(String(place.svgIconMaskURI)),
      });
      const markerView = new AdvancedMarkerElement({
        map,
        position: place.location,
        title: place.displayName,
        content: pinElement.element,
      });
      markers[type]?markers[type].push(markerView):markers[type]=[markerView];
    });
  }
}

//Clear all markers from the map
export function clearMarkers(){
  for (const type in markers){
    markers[type].forEach((marker)=>{
      if (marker.map) marker.setMap(null);
    });
    markers[type]=[];
  };
}

//Store places in object
export function savePlace(place, type){
  const placesArr=Object.values(places).flat();
  if (placesArr.find((record)=>record.id===place.id)) return;
  places[type]?places[type].push(place):places[type]=[place];
}

//Clear places in object
export function clearPlaces(){
  places={};
}

//Update the total number of places displayed
export function updatePlaceNumber(types){
  document.getElementById('place-num').innerText='';
  let numPlaces=0;
  types.forEach((type)=>{
    if(places[type]){
      numPlaces+=places[type].length;
    }
  });
  if (numPlaces===1)
    document.getElementById('place-num').innerText=`${numPlaces} Place`;
  else
    document.getElementById('place-num').innerText=`${numPlaces} Places`;
}


// Event listeners
function addCardEventListeners() {
  // array with all place cards
  let allPlaces = document.querySelectorAll(".daysOptions"); 
  // add event listener to "+" on each place card
  for(let i = 0; i < allPlaces.length; i++) {
    const cardId = allPlaces[i].id.split(" ");
    const placeId = cardId[0];
    const dayId = cardId[1];
    allPlaces[i].addEventListener("click", ()=>{
      addToItinerary (map, placeId, dayId);
    });
  }
}

// add clicked place to Itinerary
export function addToItinerary(aMap, placeId, dayId) {
  let service = new google.maps.places.PlacesService(aMap);
  service.getDetails({ placeId: placeId }, function (place, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      let dayChosenDiv = document.getElementById(`${dayId}`);
      let savedPlaceCardHTML=
        `
        <div class="added-place-card place-card" id="card ${placeId} ${dayId}" data-name="${place.name}" data-address="${place.formatted_address}">
            <div class="saved-place-content">
              <p class="place-name">${place.name}</p>
              <p class="place-address">${place.formatted_address}</p>
              <p>
              <button type="button" class="btn btn-secondary btn-sm removeBtn" id="remove ${placeId} ${dayId}"> Remove </button>
              </p>
            </div>
        </div>
        `;
      // add card to selected day
      dayChosenDiv.innerHTML += savedPlaceCardHTML;

      // display the accordion with activity added
      const accordion = document.getElementById(`accordion-${dayId}`);
      if(!accordion.classList.contains("show")){
        accordion.classList.add("show");
      };

      // add event listener
      document.querySelectorAll('.removeBtn').forEach((btn)=>{
        let btnId=btn.id.split(" ");
        if (btnId){
          btn.addEventListener('click',()=>{
            removeFromItinerary(btnId);
          });
        }
      });

    } else {
      // Handle errors
      console.error('Error getting place details');
    }
  }) 
}


export function removeFromItinerary(btnId) {
  let cardId = `card ${btnId[1]} ${btnId[2]}`;
  let dayId = `${btnId[2]}`;
  // get itinerary card and day container
  let card = document.getElementById(cardId);
  let divContainer = document.getElementById(dayId);
  let accordion = document.getElementById(`accordion-${dayId}`);
  // Check if elements exist
  if (!card) {
    console.error(`Card with ID ${cardId} not found.`);
    return;
  }
  if (!divContainer) {
    console.error(`Container with ID ${dayId} not found.`);
    return;
  }
  // Check if the card is a child of the container
  if (divContainer.contains(card)) {
    // remove itinerary card from day container
    divContainer.removeChild(card);
  } else {
    console.error(`Card with ID ${cardId} is not a child of the container with ID ${dayId}.`);
  }
}

//create and display the place card for type 
export function createPlaceCard(type){
  if(places[type]){
    places[type].forEach((place)=>{
      // console.log(place.id);
      const starPercentRounded=ratingCalc(place.rating);
      const numRatings=place.userRatingCount?place.userRatingCount.toLocaleString():'';
      let placeList=document.querySelector('.place-list');
      
      let days = document.querySelectorAll('.itineraryDayLabels');
      let daysOptions = "";
      
      for (let i = 0; i < days.length; i++) {
        let dayId = days[i].id.split("y");
        let day = dayId[1];
        daysOptions += `<li><a class="dropdown-item daysOptions" href="#" id="${place.id} ${days[i].id}">Day ${day}</a></li>`;
      }
    
      let placeCardHTML=
        `
        <div class="place-card" id="placeCard ${place.id}">
          <div class="dropdown">
            <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="button ${place.id}"> &#43 </button>
            <ul class="dropdown-menu displayDays">
               ${daysOptions}
            </ul>
          </div>
          <div class="place-content">
            <div class="icon icon-${type}">
              <i class="material-icons">local_${type}</i>
            </div>
            <p class="place-name">${place.displayName}</p>
            <p class="place-address">${getPlaceAddress(place)}</p>
            <div class="place-rating">
              <div class="stars-outer">
                <div class="stars-inner" style="width:${starPercentRounded}"></div>
              </div>
              (${numRatings}) 
            </div>
          </div>
          <div class="place-img-container">
           <img class="place-img" src="${place.photos && place.photos[0] ? place.photos[0].getURI() : "https://via.placeholder.com/150"}" alt="${place.displayName} photo">
          </div>
        </div>
        `;
      placeList.innerHTML+=placeCardHTML;
    });
  }
  addCardEventListeners();
}


function ratingCalc(rating) {
  const starPercentage = (rating / 5) * 100;
  return `${Math.round(starPercentage / 10) * 10}%`;
}

function getPlaceAddress(place) {
  let streetNumber = "";
  let streetName = "";
  let city = "";
  place.addressComponents.forEach(component => {
    // Check for street number
    if (component.types.includes("street_number")) {
      streetNumber = component.longText;
    }
    // Check for street name
    if (component.types.includes("route")) {
      streetName = component.longText;
    }
    // Check for city
    if (component.types.includes("locality")) {
      city = component.longText;
    }
  });
  // Construct the full address
  const address = `${streetNumber} ${streetName}, ${city}`;
  return address.trim();
}

//clear all place cards
export function clearAllPlaceCards(){
  document.querySelector('.place-list').innerHTML='';
}

function addActivityToSelectedDay(activity) {
  const target = document.querySelector(".accordion.show");
  if (!target){
    return;
  } 
  const targetP = target.querySelector("p");
  if (!targetP){
    return;
  }
  if (targetP.textContent.length != 0){
    targetP.textContent += ", ";
  }
  targetP.textContent += activity;
  
  
}