const apiKey = "71608a96243f764afe28114be64c6e01";
const user = "pierrelouis-c";
const refreshInterval = 10000; // 2 seconds interval
const maxRetries = 3; // Maximum number of retries per track
const retryDelay = 3000; // 3 seconds delay between retries

// Select the DOM elements
const titleElement = document.querySelector(".now-playing .title");
const artistElement = document.querySelector(".now-playing .artist");
const coverElement = document.querySelector(".now-playing .cover");
const statusElement = document.querySelector(".now-playing .status");
const defaultCoverSvg = coverElement.innerHTML; // Store the default SVG

let currentTrackName = null; // To track the current song
let retryCounts = {}; // Object to keep track of retries per track

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
        const trackName = currentTrack.name;

        // Check if the track has changed
        if (trackName !== currentTrackName) {
          currentTrackName = trackName;
          retryCounts[trackName] = 0; // Reset retry count for new track
        }

        displayTrack(currentTrack);
      } else {
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
    if (isPlaceholderImage(coverImg)) {
      handleMissingCover(track);
    } else {
      coverElement.innerHTML = `<img src="${coverImg}" alt="${trackName}" width="75" height="75">`;
      statusElement.style.display = "flex"; // Show the visualizer
    }
  } else {
    handleMissingCover(track);
  }
}

function isPlaceholderImage(url) {
  // Implement logic to determine if the image URL is the placeholder
  // This can be based on the URL pattern or other identifiable attributes
  // For example, if the placeholder has a specific filename or path
  // Adjust the condition below based on your actual placeholder URL
  return url.includes("placeholder") || url === "";
}

function handleMissingCover(track) {
  const trackName = track.name;

  if (retryCounts[trackName] < maxRetries) {
    retryCounts[trackName] += 1;
    console.warn(
      `Cover image missing for "${trackName}". Retrying (${retryCounts[trackName]}/${maxRetries})...`
    );
    // Schedule a retry after retryDelay milliseconds
    setTimeout(() => {
      retryFetchCover(track);
    }, retryDelay);
  } else {
    console.error(
      `Failed to fetch cover image for "${trackName}" after ${maxRetries} retries. Using default cover.`
    );
    coverElement.innerHTML = defaultCoverSvg; // Use default SVG after max retries
    statusElement.style.display = "flex"; // Show the visualizer
  }
}

async function retryFetchCover(track) {
  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(
        track.artist["#text"]
      )}&track=${encodeURIComponent(track.name)}&format=json`
    );
    const data = await response.json();

    if (data.track && data.track.album && data.track.album.image) {
      const newCoverImg =
        data.track.album.image[data.track.album.image.length - 1]["#text"];

      if (newCoverImg && !isPlaceholderImage(newCoverImg)) {
        // Update the cover image if a valid one is found
        coverElement.innerHTML = `<img src="${newCoverImg}" alt="${track.name}" width="75" height="75">`;
        console.log(`Successfully fetched updated cover for "${track.name}".`);
      } else {
        handleMissingCover(track); // Retry if still placeholder
      }
    } else {
      handleMissingCover(track); // Retry if no image data
    }
  } catch (error) {
    console.error(`Error retrying to fetch cover for "${track.name}":`, error);
    handleMissingCover(track); // Retry on error
  }
}

function resetTrackInfo() {
  // Reset the title, artist, and cover to default
  titleElement.textContent = "Nothing right now";
  artistElement.textContent = "I'm not currently listening to any music";
  coverElement.innerHTML = defaultCoverSvg; // Restore the default SVG
  statusElement.style.display = "none"; // Hide the status visualizer
  currentTrackName = null; // Reset current track name
}

// Call the function when the page loads
getCurrentlyPlayingTrack();

// Set up the interval to refresh every refreshInterval milliseconds
setInterval(getCurrentlyPlayingTrack, refreshInterval);
