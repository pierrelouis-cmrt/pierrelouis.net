// Copy email to clipboard + keep link crawlable
document.addEventListener("DOMContentLoaded", () => {
  const tooltipContainer = document.querySelector(".email-tooltip-wrapper");

  if (tooltipContainer) {
    const tooltip = tooltipContainer.querySelector(".email-tooltip");
    const emailLink = tooltipContainer.querySelector(
      "a.email-link.link-with-icon"
    );

    // Use the href as the single source of truth (crawlable)
    const emailFromHref = (emailLink?.getAttribute("href") || "").replace(
      /^mailto:/,
      ""
    );
    const emailToCopy =
      emailFromHref ||
      tooltipContainer.dataset.email ||
      "contact@pierrelouis.net";

    const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`;

    const copyCheckIconSVG = `<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 15 2 2 4-4"/>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`;

    function setIcon(iconSVG) {
      if (!emailLink) return;
      const existingIcon = emailLink.querySelector("svg");
      if (existingIcon) existingIcon.remove();
      const template = document.createElement("template");
      template.innerHTML = iconSVG.trim();
      emailLink.appendChild(template.content.firstChild);
    }

    // Keep the original tooltip HTML so we can restore it
    const originalTooltipHTML = tooltip ? tooltip.innerHTML : "";
    let revertTimer;

    const handleCopyEmail = (e) => {
      // Prevent navigation so click only copies (link remains crawlable)
      e.preventDefault();

      navigator.clipboard
        .writeText(emailToCopy)
        .then(() => {
          if (tooltip) tooltip.textContent = "Copied";
          setIcon(copyCheckIconSVG);
          if (window.umami && typeof window.umami.track === "function") {
            window.umami.track("Email copied", { source: "footer" });
          }

          clearTimeout(revertTimer);
          revertTimer = setTimeout(() => {
            if (tooltip) tooltip.innerHTML = originalTooltipHTML; // restore email text
            setIcon(copyIconSVG);
          }, 1000);
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    };

    tooltipContainer.addEventListener("click", handleCopyEmail);

    // Ensure that whenever the user hovers again, the email shows in the tooltip
    tooltipContainer.addEventListener("mouseenter", () => {
      if (tooltip) tooltip.innerHTML = originalTooltipHTML;
      setIcon(copyIconSVG);
    });
  }

  // Optional: HEAD is lighter than GET if supported by your host
  fetch(window.location.href, { method: "HEAD" })
    .then((response) => {
      const lastModified = response.headers.get("Last-Modified");
      if (lastModified) {
        const footerText = document.querySelector(".footer-meta-right");
        if (footerText) {
          footerText.textContent = `Updated ${new Date(
            lastModified
          ).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}`;
        }
      }
    })
    .catch((err) => {
      // Non-fatal if headers aren't available
      console.warn("Could not read Last-Modified header:", err);
    });
});
