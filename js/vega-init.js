(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    if (typeof vegaEmbed !== "function") {
      console.error("[vega-init] vegaEmbed not found; include Vega/VL/Embed scripts in head.");
      return;
    }
    document.querySelectorAll(".pkg-chart[data-vega-spec]").forEach(function (el) {
      var specUrl = el.getAttribute("data-vega-spec");
      if (!specUrl) return;
      vegaEmbed(el, specUrl, { actions: false })
        .catch(function (e) { console.error("[vega-init] embed failed", specUrl, e); });
    });
  });
})();
