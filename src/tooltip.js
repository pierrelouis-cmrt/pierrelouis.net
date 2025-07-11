// Copy email to clipboard

document.addEventListener("DOMContentLoaded", () => {
  const tooltipContainer = document.querySelector(".tooltip-container");
  const emailToCopy = "contact@pierrelouis.net";
  const tooltip = tooltipContainer.querySelector(".tooltip");
  const emailLink = tooltipContainer.querySelector("a.email.inline-icon");

  // SVG icons as strings
  const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" 
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
      stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>`;

  const copyCheckIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" 
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
      stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-check">
      <path d="m12 15 2 2 4-4"/>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>`;

  // Function to replace the icon
  function setIcon(iconSVG) {
    const existingIcon = emailLink.querySelector("svg");
    if (existingIcon) {
      emailLink.removeChild(existingIcon);
    }
    const template = document.createElement("template");
    template.innerHTML = iconSVG.trim();
    const newIcon = template.content.firstChild;
    emailLink.appendChild(newIcon);
  }

  const handleCopyEmail = () => {
    navigator.clipboard
      .writeText(emailToCopy)
      .then(() => {
        tooltip.textContent = "Copied";
        setIcon(copyCheckIconSVG); // Replace with the 'copy-check' icon
        setTimeout(() => {
          tooltip.textContent = "Copy Email";
          setIcon(copyIconSVG); // Revert back to the original 'copy' icon
        }, 1000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  tooltipContainer.addEventListener("click", handleCopyEmail);
});
