import { renderHeader } from "./shared/header.js";

renderHeader();

document.querySelectorAll('.delete-btn').forEach((btn) => {
  btn.addEventListener('click', async (e) => {
    const container = e.target.closest('.save-itinerary-container');
    if (container) {
      const itineraryId = container.id;
      try {
        await deleteActivities(itineraryId);
        await deleteItinerary(itineraryId);
        // Remove the container from the DOM
        container.remove();
      } catch (error) {
        console.error("Error during deletion:", error);
      }
    }
  });
});

async function deleteItinerary(itineraryId) {
  try {
    const response = await fetch('/api/deleteItinerary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itineraryId })
    });
    if (!response.ok) {
      throw new Error('Failed to delete itinerary');
    }
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error deleting itinerary:', error);
  }
}

async function deleteActivities(itineraryId) {
  try {
    const response = await fetch('/api/deleteActivities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itineraryId })
    });
    if (!response.ok) {
      throw new Error('Failed to delete activities');
    }
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error deleting activities:', error);
  }
}
