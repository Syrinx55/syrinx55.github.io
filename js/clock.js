(function () {
  const HOME_TZ = "America/Chicago";         // your zone (CST/CDT)
  const TARGET_EL_ID = "contact-clock";

  function getAbbrev(date, tz) {
    // e.g. "2:35:10 PM CDT" -> "CDT"
    return date.toLocaleTimeString("en-US", { timeZone: tz, timeZoneName: "short" })
               .split(" ").pop();
  }

  function hoursDiffTo(timeZone) {
    // Compare the same instant rendered in the target zone vs local
    const now = new Date();
    const tzStr = now.toLocaleString("en-US", { timeZone });
    const tzDate = new Date(tzStr);
    const diffMs = tzDate.getTime() - now.getTime(); // positive if target is ahead
    const hours = Math.round(diffMs / 3600000);
    return hours > 0 ? `+${hours}` : `${hours}`;
  }

  function render() {
    const el = document.getElementById(TARGET_EL_ID);
    if (!el) return;

    const now = new Date();

    // Local time (visitor)
    const localStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    });
    const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Your time (America/Chicago)
    const myStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit",
      timeZoneName: "short", timeZone: HOME_TZ
    });

    const diffStr = hoursDiffTo(HOME_TZ);

    el.innerHTML = `
      <div><strong>Your Time:</strong> ${localStr}</div>
      <div><strong>My Time:</strong> ${myStr} (${HOME_TZ})</div>
      <div><strong>Difference:</strong> ${diffStr}h</div>
    `;
    el.style.textAlign = "center";
    el.style.fontWeight = "600";
  }

  // Run only on the page that has the clock container
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  ready(function () {
    if (document.getElementById("contact-clock")) {
      render();
      setInterval(render, 1000);
    }
  });
})();
