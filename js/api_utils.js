/**
 * API Utility Functions
 * Common functions for making POST requests to APIs with proper error handling
 */

/**
 * Make a POST request to an API endpoint with proper error handling
 * @param {string} url - The API endpoint URL
 * @param {Object} data - The data to send in the request body
 * @param {Object} options - Additional options for the request
 * @returns {Promise<Object>} - The parsed JSON response
 */
async function apiPost(url, data = {}, options = {}) {
  const defaultOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(data),
  };

  const requestOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, requestOptions);

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Try to parse JSON response
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const json = await response.json();

      // Check for API-level errors
      if (json.success === false) {
        throw new Error(json.error || "API request failed");
      }

      return json;
    } else {
      // For non-JSON responses (like CSV downloads)
      return response;
    }
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    throw error;
  }
}

/**
 * Make a POST request for data fetching (GET-like operations via POST)
 * @param {string} url - The API endpoint URL
 * @param {Object} data - Optional data to send
 * @returns {Promise<Object>} - The parsed JSON response
 */
async function apiFetch(url, data = {}) {
  return apiPost(url, data, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

/**
 * Make a POST request for file downloads (CSV, etc.)
 * @param {string} url - The API endpoint URL
 * @param {Object} data - Optional data to send
 * @returns {Promise<Response>} - The response object
 */
async function apiDownload(url, data = {}) {
  return apiPost(url, data, {
    headers: {
      "Content-Type": "application/json",
      Accept: "text/csv,application/octet-stream,*/*",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

/**
 * Validate API response structure
 * @param {Object} response - The API response object
 * @param {string} expectedDataKey - The expected data key (default: 'data')
 * @returns {boolean} - Whether the response is valid
 */
function validateApiResponse(response, expectedDataKey = "data") {
  if (!response || typeof response !== "object") {
    return false;
  }

  if (response.success === false) {
    return false;
  }

  if (expectedDataKey && !(expectedDataKey in response)) {
    return false;
  }

  return true;
}

/**
 * Handle API errors with user-friendly messages
 * @param {Error} error - The error object
 * @param {string} operation - Description of the operation that failed
 * @returns {string} - User-friendly error message
 */
function handleApiError(error, operation = "API request") {
  console.error(`${operation} failed:`, error);

  if (error.message.includes("HTTP 405")) {
    return "Server configuration error. Please contact administrator.";
  } else if (error.message.includes("HTTP 401")) {
    return "Authentication required. Please log in again.";
  } else if (error.message.includes("HTTP 403")) {
    return "Access denied. You do not have permission for this action.";
  } else if (error.message.includes("HTTP 500")) {
    return "Server error. Please try again later.";
  } else if (
    error.message.includes("NetworkError") ||
    error.message.includes("fetch")
  ) {
    return "Network error. Please check your connection and try again.";
  } else {
    return error.message || `${operation} failed. Please try again.`;
  }
}

// Export functions for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    apiPost,
    apiFetch,
    apiDownload,
    validateApiResponse,
    handleApiError,
  };
}
