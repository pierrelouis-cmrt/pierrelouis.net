const apiKey = "YOUR_API_KEY"; // Replace with environment-injected value in the workflow
const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=YOUR_LASTFM_USER&api_key=${apiKey}&format=json`;

async function fetchRecentTracks() {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    const tracks = data.recenttracks.track;

    const trackList = document.getElementById("tracks");
    tracks.forEach((track) => {
      const li = document.createElement("li");
      li.textContent = `${track.artist["#text"]} - ${track.name}`;
      trackList.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching tracks:", error);
  }
}

fetchRecentTracks();
