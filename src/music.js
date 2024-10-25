const apiKey = "71608a96243f764afe28114be64c6e01";
const user = "pierrelouis-c";
const refreshInterval = 2000; // 2 seconds interval

// Select the DOM elements
const titleElement = document.querySelector(".now-playing .title");
const artistElement = document.querySelector(".now-playing .artist");
const coverElement = document.querySelector(".now-playing .cover");
const statusElement = document.querySelector(".now-playing .status");
const defaultCoverSvg = coverElement.innerHTML; // Store the default SVG

async function getCurrentlyPlayingTrack() {
  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${user}&api_key=${apiKey}&format=json&limit=1`
    );
    const data = await response.json();

    const recentTracks = data.recenttracks.track;
    if (recentTracks && recentTracks.length > 0) {
      const currentTrack = recentTracks[0];

      if (
        currentTrack["@attr"] &&
        currentTrack["@attr"].nowplaying === "true"
      ) {
        // Currently playing track
        displayTrack(currentTrack);
      } else {
        // Not currently playing a track
        resetTrackInfo();
      }
    } else {
      resetTrackInfo();
    }
  } catch (error) {
    console.error("Error fetching track information:", error);
    resetTrackInfo(); // Reset in case of an error to keep it consistent
  }
}

function displayTrack(track) {
  const artist = track.artist["#text"];
  const trackName = track.name;
  const trackUrl = track.url;
  const coverImg =
    track.image && track.image.length > 0
      ? track.image[track.image.length - 1]["#text"]
      : null;

  // Update the title and artist
  titleElement.innerHTML = `<a href="${trackUrl}" target="_blank">${trackName}</a>`;
  artistElement.textContent = artist;

  // Replace the cover SVG with the track cover image
  if (coverImg) {
    coverElement.innerHTML = `<img src="${coverImg}" alt="${trackName}" width="75" height="75">`;
  }

  // Show the visualizer status only when the music is playing
  statusElement.style.display = "flex"; // "flex" ensures it maintains alignment
}

function resetTrackInfo() {
  // Reset the title, artist, and cover to default
  titleElement.textContent = "Nothing right now";
  artistElement.textContent = "I'm not currently listening to any music";
  coverElement.innerHTML = defaultCoverSvg; // Restore the default SVG
  statusElement.style.display = "none"; // Hide the status visualizer
}

// Call the function when the page loads
getCurrentlyPlayingTrack();

// Set up the interval to refresh every refreshInterval milliseconds
setInterval(getCurrentlyPlayingTrack, refreshInterval);
