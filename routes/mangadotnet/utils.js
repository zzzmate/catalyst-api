const BASE_URL = "https://mangadot.net";
const API_URL = "https://mangadot.net/api/manga/section";

const ORIGIN_MAP = {
  manga: "JP",
  manhwa: "CN",
  manhua: "TW",
};

const ALL_ORIGINS = "JP,CN,TW";

const RANGE_MAP = {
  day: "daily",
  daily: "daily",
  week: "weekly",
  weekly: "weekly",
  month: "monthly",
  monthly: "monthly",
};

function getOrigin(type) {
  if (!type || type === "all") return ALL_ORIGINS;
  return ORIGIN_MAP[type] || ALL_ORIGINS;
}

function getRange(range) {
  return RANGE_MAP[range] || "weekly";
}

function normalizeAdult(adult) {
  if (adult === "1" || adult === 1 || adult === true || adult === "true")
    return "1";
  return "0";
}

function proxifyPhotos(data, req) {
  if (!data) return data;
  const proxyBase = `${req.protocol}://${req.get("host")}/mangadotnet/proxy`;

  const rewrite = (photo) => {
    if (!photo) return photo;
    const full = photo.startsWith("http") ? photo : `${BASE_URL}${photo}`;
    return `${proxyBase}?url=${encodeURIComponent(full)}`;
  };

  const processItem = (item) => {
    if (item && typeof item === "object" && "photo" in item) {
      item.original_photo = item.photo
        ? item.photo.startsWith("http")
          ? item.photo
          : `${BASE_URL}${item.photo}`
        : null;
      item.photo = rewrite(item.photo);
    }
    return item;
  };

  if (Array.isArray(data)) {
    return data.map(processItem);
  }

  if (data.items && Array.isArray(data.items)) {
    data.items = data.items.map(processItem);
  }
  if (data.data && Array.isArray(data.data)) {
    data.data = data.data.map(processItem);
  }
  if (data.results && Array.isArray(data.results)) {
    data.results = data.results.map(processItem);
  }

  return data;
}

module.exports = {
  BASE_URL,
  API_URL,
  getOrigin,
  getRange,
  normalizeAdult,
  proxifyPhotos,
};
