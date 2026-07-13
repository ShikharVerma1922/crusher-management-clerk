export const API_CONFIG = {
  // BASE_URL: "https://api.mandarenterprises.com/api",
  BASE_URL: "http://localhost:3000/api",
  TIMEOUT: 6000,
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    IS_ONLINE: "/is-online",
  },
  MATERIAL: {
    GET_MATERIAL_LIST: "/materials/clerk",
  },
  TRANSACTION: {
    POST_TRANSACTION: "/transactions",
    GET_LATEST_RECEIPT_NUM: "/transactions/latest-receipt-num",
  },
  VOID_REQUEST: {
    POST_VOID_REQUEST: "/void-requests",
  },
};
