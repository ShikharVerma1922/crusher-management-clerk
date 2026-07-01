import axios from "axios";
import { API_CONFIG } from "../constants";

const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// 📡 INDUSTRIAL-GRADE AUTOMATED RETRY INTERCEPTOR LAYER
apiClient.interceptors.response.use(
  (response) => response, // Pass successful requests straight through untouched
  async (error) => {
    const { config, message } = error;

    // If config doesn't exist or retry options aren't set up, reject immediately
    if (!config) return Promise.reject(error);

    // Initialize tracking variables inside the transient request config block
    config.__retryCount = config.__retryCount || 0;
    const MAX_RETRIES = 3;

    // Check if the error is caused by a connection timeout or general network failure
    const isNetworkFault =
      error.code === "ECONNABORTED" ||
      message.includes("Network Error") ||
      !error.response;

    // Only attempt retries for transient network/timeout drops (Don't retry 401, 403, or 400 bad inputs)
    if (isNetworkFault && config.__retryCount < MAX_RETRIES) {
      config.__retryCount += 1;

      // ⏱️ EXPONENTIAL BACKOFF MATH CALCULATION: (2^retryCount) * 1000 milliseconds
      const backoffDelayDuration = Math.pow(2, config.__retryCount) * 1000;

      console.log(
        `📡 [Network Resiliency Interceptor] Drop detected: "${message}". Retrying request pipeline execution (Attempt ${config.__retryCount}/${MAX_RETRIES}) in ${backoffDelayDuration}ms...`,
      );

      // Create a native promise delay timer to hold execution threads before firing again
      const delayBackoffPromise = new Promise((resolve) => {
        setTimeout(resolve, backoffDelayDuration);
      });

      // Wait out the delay timer, then re-execute the exact same axios request instance config
      await delayBackoffPromise;
      return apiClient(config);
    }

    // If we reach here, it's a hard failure (e.g., 401 unauthorized or max retries exhausted)
    return Promise.reject(error);
  },
);

export default apiClient;
