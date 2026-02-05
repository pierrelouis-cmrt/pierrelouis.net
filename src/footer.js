document.addEventListener("DOMContentLoaded",()=>{const o=document.querySelector(".email-tooltip-wrapper");if(o){let n=function(c){if(!t)return;const i=t.querySelector("svg");i&&i.remove();const s=document.createElement("template");s.innerHTML=c.trim(),t.appendChild(s.content.firstChild)};var u=n;const e=o.querySelector(".email-tooltip"),t=o.querySelector("a.email-link.link-with-icon"),m=((t==null?void 0:t.getAttribute("href"))||"").replace(/^mailto:/,"")||o.dataset.email||"contact@pierrelouis.net",a=`<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`,h=`<svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 15 2 2 4-4"/>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`,l=e?e.innerHTML:"";let d;const p=c=>{c.preventDefault(),navigator.clipboard.writeText(m).then(()=>{e&&(e.textContent="Copied"),n(h),window.umami&&typeof window.umami.track=="function"&&window.umami.track("Email copied",{source:"footer"}),clearTimeout(d),d=setTimeout(()=>{e&&(e.innerHTML=l),n(a)},1e3)}).catch(i=>{console.error("Failed to copy: ",i)})};o.addEventListener("click",p),o.addEventListener("mouseenter",()=>{e&&(e.innerHTML=l),n(a)})}fetch(window.location.href,{method:"HEAD"}).then(e=>{const t=e.headers.get("Last-Modified");if(t){const r=document.querySelector(".footer-meta-right");r&&(r.textContent=`Updated ${new Date(t).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}`)}}).catch(e=>{console.warn("Could not read Last-Modified header:",e)})});
