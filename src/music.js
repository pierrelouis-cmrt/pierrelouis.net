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

//----------------------------------------------------

function randomizeBars() {
  document.querySelectorAll(".bar").forEach((bar) => {
    // Generate random heights for keyframes
    const randomHeights = Array.from(
      { length: 4 },
      () => Math.random() * 80 + 20
    ); // Between 20% and 100%

    // Apply a unique animation to each bar with random timings
    const randomDuration = (Math.random() * 0.5 + 0.8).toFixed(2); // Random duration between 0.8s and 1.3s
    const randomDelay = (Math.random() * -1).toFixed(2); // Random delay up to -1s

    // Set custom keyframes using inline CSS for each bar
    bar.style.animationDuration = `${randomDuration}s`;
    bar.style.animationDelay = `${randomDelay}s`;

    // Inject unique keyframes for each bar to vary the animation heights
    const keyframes = `
      @keyframes custom-bounce-${bar.dataset.index} {
        0% { height: ${randomHeights[0]}%; }
        25% { height: ${randomHeights[1]}%; }
        50% { height: ${randomHeights[2]}%; }
        75% { height: ${randomHeights[3]}%; }
        100% { height: ${randomHeights[0]}%; }
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = keyframes;
    document.head.appendChild(styleSheet);

    // Apply the newly created keyframes to each bar
    bar.style.animationName = `custom-bounce-${bar.dataset.index}`;
  });
}

// Assign unique data-index for each bar and randomize animations
document.querySelectorAll(".bar").forEach((bar, index) => {
  bar.dataset.index = index;
});

randomizeBars();
