document.addEventListener("DOMContentLoaded", () => {
  const tooltipContainer = document.querySelector(".tooltip-container");
  const emailToCopy = "me@pierrelouis.net";
  const tooltip = tooltipContainer.querySelector(".tooltip");
  const icon = tooltipContainer.querySelector("ion-icon");

  const handleCopyEmail = () => {
    navigator.clipboard
      .writeText(emailToCopy)
      .then(() => {
        tooltip.textContent = "Copied";
        icon.setAttribute("name", "checkmark-circle");
        setTimeout(() => {
          tooltip.textContent = "Copy Email";
          icon.setAttribute("name", "copy-outline");
        }, 1000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  tooltipContainer.addEventListener("click", handleCopyEmail);
});
