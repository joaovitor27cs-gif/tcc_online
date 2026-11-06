(() => {
  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  window.CASHFLIP_API_BASE = `${protocol}//${host}:5000/api`;
})();
