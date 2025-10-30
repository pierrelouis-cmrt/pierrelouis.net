// Photos Page JavaScript
// Handles photo gallery filtering, display, and lightbox integration

(function () {
  'use strict';

  // Photo data structure
  const photoData = {
    Denmark: [
      { file: 'architecture25.png', category: 'architecture' },
      { file: 'architecture26.png', category: 'architecture' },
      { file: 'architecture27.png', category: 'architecture' },
      { file: 'architecture28.png', category: 'architecture' }
    ],
    Norway: [
      { file: 'architecture5.png', category: 'architecture' },
      { file: 'architecture6.png', category: 'architecture' },
      { file: 'architecture7.png', category: 'architecture' },
      { file: 'architecture8.png', category: 'architecture' },
      { file: 'architecture9.png', category: 'architecture' },
      { file: 'architecture10.png', category: 'architecture' },
      { file: 'architecture11.png', category: 'architecture' },
      { file: 'architecture12.png', category: 'architecture' },
      { file: 'architecture13.png', category: 'architecture' },
      { file: 'landscape1.png', category: 'landscape' },
      { file: 'landscape4.png', category: 'landscape' },
      { file: 'landscape5.png', category: 'landscape' },
      { file: 'landscape6.png', category: 'landscape' },
      { file: 'landscape7.png', category: 'landscape' },
      { file: 'landscape8.png', category: 'landscape' },
      { file: 'landscape9.png', category: 'landscape' },
      { file: 'landscape10.png', category: 'landscape' },
      { file: 'landscape11.png', category: 'landscape' },
      { file: 'landscape12.png', category: 'landscape' },
      { file: 'landscape13.png', category: 'landscape' },
      { file: 'misc5.png', category: 'misc' }
    ],
    Paris: [
      { file: 'architecture2.png', category: 'architecture' },
      { file: 'architecture3.png', category: 'architecture' },
      { file: 'architecture29.png', category: 'architecture' },
      { file: 'architecture30.png', category: 'architecture' },
      { file: 'architecture31.png', category: 'architecture' },
      { file: 'architecture32.png', category: 'architecture' }
    ],
    Sweden: [
      { file: 'animal4.png', category: 'animal' },
      { file: 'architecture14.png', category: 'architecture' },
      { file: 'architecture15.png', category: 'architecture' },
      { file: 'architecture16.png', category: 'architecture' },
      { file: 'architecture17.png', category: 'architecture' },
      { file: 'architecture18.png', category: 'architecture' },
      { file: 'architecture19.png', category: 'architecture' },
      { file: 'architecture20.png', category: 'architecture' },
      { file: 'architecture21.png', category: 'architecture' },
      { file: 'architecture22.png', category: 'architecture' },
      { file: 'architecture23.png', category: 'architecture' },
      { file: 'architecture24.png', category: 'architecture' },
      { file: 'landscape14.png', category: 'landscape' },
      { file: 'misc6.png', category: 'misc' },
      { file: 'misc7.png', category: 'misc' }
    ],
    Other: [
      { file: 'animal1.png', category: 'animal' },
      { file: 'animal2.png', category: 'animal' },
      { file: 'animal3.png', category: 'animal' },
      { file: 'animal5.png', category: 'animal' },
      { file: 'animal6.png', category: 'animal' },
      { file: 'animal7.png', category: 'animal' },
      { file: 'animal8.png', category: 'animal' },
      { file: 'architecture1.png', category: 'architecture' },
      { file: 'architecture4.png', category: 'architecture' },
      { file: 'landscape2.png', category: 'landscape' },
      { file: 'landscape3.png', category: 'landscape' },
      { file: 'landscape15.png', category: 'landscape' },
      { file: 'landscape16.png', category: 'landscape' },
      { file: 'misc1.png', category: 'misc' },
      { file: 'misc2.png', category: 'misc' },
      { file: 'misc3.png', category: 'misc' },
      { file: 'misc4.png', category: 'misc' }
    ]
  };

  // State management
  let currentView = 'home';
  let currentFilter = { type: null, value: null };

  // DOM Elements
  const homeView = document.getElementById('photos-home-view');
  const galleryView = document.getElementById('photos-gallery-view');
  const galleryGrid = document.getElementById('photos-gallery-grid');
  const galleryTitle = document.getElementById('gallery-title');
  const backButton = document.getElementById('back-to-home');

  // Category/Trip buttons
  const tripCards = document.querySelectorAll('.photo-trip-card');
  const categoryButtons = document.querySelectorAll('.photo-category-button');

  // Initialize
  function init() {
    updateCounts();
    attachEventListeners();
  }

  // Update photo counts
  function updateCounts() {
    // Count photos per trip
    tripCards.forEach(card => {
      const trip = card.dataset.trip;
      const count = photoData[trip] ? photoData[trip].length : 0;
      const countSpan = card.querySelector('.photo-trip-count');
      if (countSpan) {
        countSpan.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
      }
    });

    // Count photos per category
    const categoryCounts = {
      architecture: 0,
      landscape: 0,
      animal: 0,
      misc: 0
    };

    Object.values(photoData).forEach(photos => {
      photos.forEach(photo => {
        if (categoryCounts[photo.category] !== undefined) {
          categoryCounts[photo.category]++;
        }
      });
    });

    categoryButtons.forEach(button => {
      const category = button.dataset.category;
      const count = categoryCounts[category] || 0;
      const countSpan = button.querySelector('.photo-category-count');
      if (countSpan) {
        countSpan.textContent = `${count} photo${count !== 1 ? 's' : ''}`;
      }
    });
  }

  // Attach event listeners
  function attachEventListeners() {
    // Trip card clicks
    tripCards.forEach(card => {
      card.addEventListener('click', () => {
        const trip = card.dataset.trip;
        showGallery('trip', trip);
      });
    });

    // Category button clicks
    categoryButtons.forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        showGallery('category', category);
      });
    });

    // Back button
    backButton.addEventListener('click', () => {
      showHome();
    });
  }

  // Show home view
  function showHome() {
    currentView = 'home';
    homeView.style.display = 'block';
    galleryView.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Show gallery view
  function showGallery(filterType, filterValue) {
    currentView = 'gallery';
    currentFilter = { type: filterType, value: filterValue };

    // Update title
    const displayValue = filterValue === 'misc' ? 'Miscellaneous' :
                         filterValue.charAt(0).toUpperCase() + filterValue.slice(1);
    galleryTitle.textContent = displayValue;

    // Get filtered photos
    const photos = getFilteredPhotos(filterType, filterValue);

    // Render gallery
    renderGallery(photos);

    // Show gallery view
    homeView.style.display = 'none';
    galleryView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Get filtered photos
  function getFilteredPhotos(filterType, filterValue) {
    const photos = [];

    if (filterType === 'trip') {
      // Get all photos from a specific trip
      if (photoData[filterValue]) {
        photoData[filterValue].forEach(photo => {
          photos.push({
            src: `pics/${filterValue}/${photo.file}`,
            trip: filterValue,
            category: photo.category,
            file: photo.file
          });
        });
      }
    } else if (filterType === 'category') {
      // Get all photos of a specific category across all trips
      Object.entries(photoData).forEach(([trip, tripPhotos]) => {
        tripPhotos.forEach(photo => {
          if (photo.category === filterValue) {
            photos.push({
              src: `pics/${trip}/${photo.file}`,
              trip: trip,
              category: photo.category,
              file: photo.file
            });
          }
        });
      });
    }

    return photos;
  }

  // Render gallery in 2-column masonry layout
  function renderGallery(photos) {
    galleryGrid.innerHTML = '';

    // Create two columns
    const column1 = document.createElement('div');
    const column2 = document.createElement('div');
    column1.className = 'photos-gallery-column';
    column2.className = 'photos-gallery-column';

    // Distribute photos between columns
    photos.forEach((photo, index) => {
      const photoItem = createPhotoItem(photo, index);
      if (index % 2 === 0) {
        column1.appendChild(photoItem);
      } else {
        column2.appendChild(photoItem);
      }
    });

    galleryGrid.appendChild(column1);
    galleryGrid.appendChild(column2);

    // Initialize lightbox for the current selection
    initializeLightboxForGallery(photos);
  }

  // Create photo item element
  function createPhotoItem(photo, index) {
    const item = document.createElement('div');
    item.className = 'photos-gallery-item';

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = `${photo.category} photo from ${photo.trip}`;
    img.loading = 'lazy';
    img.dataset.lightboxIndex = index;
    img.dataset.lightboxGroup = 'current-gallery';

    item.appendChild(img);
    return item;
  }

  // Initialize lightbox for current gallery
  function initializeLightboxForGallery(photos) {
    // Wait for the existing lightbox to be available
    if (window.PhotoLightbox) {
      // Prepare photo data for lightbox
      const lightboxPhotos = photos.map(photo => ({
        src: photo.src,
        alt: `${photo.category} photo from ${photo.trip}`
      }));

      // Initialize lightbox with the current gallery photos
      const lightboxInstance = new window.PhotoLightbox({
        selector: '[data-lightbox-group="current-gallery"]',
        photos: lightboxPhotos
      });
    } else {
      // Fallback: use the existing lightbox initialization
      setTimeout(() => initializeLightboxForGallery(photos), 100);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
