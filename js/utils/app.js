const API_BASE = window.location.origin + "/api";

const App = (function () {
  "use strict";

  // ==================== STATE ====================
  let currentUser = null;
  let syncManager = null;
  let socket = null;
  let authToken = null;
  let deviceId = null;

  // ==================== INITIALIZATION ====================
  function init() {
    console.log("🚀 SCOSY App initializing...");

    // Initialize sync manager
    syncManager = new SyncManager();

    // Check for saved session
    checkSavedSession();

    // Setup event listeners
    setupEventListeners();

    // Initialize Socket.IO connection if authenticated
    if (authToken) {
      initializeSocket();
    }

    console.log("✅ SCOSY App initialized");
  }

  // ==================== AUTHENTICATION ====================
  async function login(credentials, deviceInfo) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          deviceInfo: deviceInfo || getDeviceInfo(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        authToken = data.token;
        deviceId = data.deviceId;
        currentUser = data.user;

        // Save session
        localStorage.setItem("scosy_auth_token", authToken);
        localStorage.setItem("scosy_device_id", deviceId);
        localStorage.setItem("scosy_user", JSON.stringify(currentUser));

        // Initialize sync manager with authentication
        await syncManager.initializeConnection(
          currentUser.id,
          currentUser.userType,
          authToken
        );

        // Initialize Socket.IO
        initializeSocket();

        return { success: true, user: currentUser };
      } else {
        throw new Error(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  }

  async function logout() {
    try {
      if (authToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local data
      authToken = null;
      deviceId = null;
      currentUser = null;

      localStorage.removeItem("scosy_auth_token");
      localStorage.removeItem("scosy_device_id");
      localStorage.removeItem("scosy_user");

      // Disconnect sync manager
      if (syncManager) {
        syncManager.disconnect();
      }

      // Disconnect socket
      if (socket) {
        socket.disconnect();
      }

      // Redirect to login
      window.location.reload();
    }
  }

  function checkSavedSession() {
    const savedToken = localStorage.getItem("scosy_auth_token");
    const savedDeviceId = localStorage.getItem("scosy_device_id");
    const savedUser = localStorage.getItem("scosy_user");

    if (savedToken && savedDeviceId && savedUser) {
      authToken = savedToken;
      deviceId = savedDeviceId;
      currentUser = JSON.parse(savedUser);

      console.log("📱 Restored session for:", currentUser.name);
    }
  }

  // ==================== SOCKET.IO ====================
  function initializeSocket() {
    if (!authToken || !currentUser) return;

    socket = io({
      auth: {
        token: authToken,
        deviceId: deviceId,
        userId: currentUser.id,
        userType: currentUser.userType,
      },
    });

    socket.on("connect", () => {
      console.log("🔗 Socket connected");

      // Join user-specific room
      socket.emit("join-room", {
        userId: currentUser.id,
        deviceId: deviceId,
      });
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
    });

    // Handle real-time notifications
    socket.on("new-complaint", (data) => {
      if (currentUser.userType === "admin") {
        showNotification(
          "New Complaint",
          `New complaint received: ${data.subject}`
        );
        updateAdminStats();
      }
    });

    socket.on("complaint-response", (data) => {
      if (currentUser.userType === "student") {
        showNotification(
          "Complaint Response",
          "You have a new response to your complaint"
        );
        updateComplaintsList();
      }
    });

    // Handle cross-device sync events
    socket.on("device-connected", (data) => {
      console.log("📱 New device connected:", data.deviceId);
    });

    socket.on("device-disconnected", (data) => {
      console.log("📱 Device disconnected:", data.deviceId);
    });
  }

  // ==================== DEVICE MANAGEMENT ====================
  function getDeviceInfo() {
    return {
      type: getDeviceType(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height,
      },
      hasTouch: "ontouchstart" in window,
      pixelRatio: window.devicePixelRatio || 1,
    };
  }

  function getDeviceType() {
    const width = window.innerWidth;
    const hasTouch = "ontouchstart" in window;

    if (width <= 768) {
      return "mobile";
    } else if (width <= 1024 && hasTouch) {
      return "tablet";
    } else {
      return "desktop";
    }
  }

  // ==================== NOTIFICATIONS ====================
  function showNotification(title, body, options = {}) {
    // Check if notifications are supported and permitted
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        tag: "scosy-notification",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    } else {
      // Fallback to in-app notification
      showToast(title + ": " + body, "info");
    }
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon =
      type === "success"
        ? "check-circle"
        : type === "error"
        ? "exclamation-circle"
        : type === "warning"
        ? "exclamation-triangle"
        : "info-circle";

    toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  // ==================== EVENT LISTENERS ====================
  function setupEventListeners() {
    // Online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Visibility change for sync
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function handleOnline() {
    console.log("🌐 Back online");
    updateConnectionStatus(true);

    // Sync pending changes
    if (syncManager) {
      syncManager.syncPendingChanges();
    }
  }

  function handleOffline() {
    console.log("📴 Gone offline");
    updateConnectionStatus(false);
  }

  function handleVisibilityChange() {
    if (!document.hidden && navigator.onLine && syncManager) {
      // App became visible and we're online - sync any pending changes
      syncManager.syncPendingChanges();
    }
  }

  function updateConnectionStatus(isOnline) {
    const statusElement = document.getElementById("connectionStatus");
    if (statusElement) {
      statusElement.className = isOnline
        ? "connection-status status-online"
        : "connection-status status-offline";
      statusElement.innerHTML = `
                <i class="fas fa-${isOnline ? "wifi" : "wifi-slash"}"></i>
                <span>${isOnline ? "Online" : "Offline"}</span>
                <div class="sync-indicator" id="syncIndicator"></div>
            `;
    }
  }

  function updateComplaintsList() {
    // Refresh complaints list - implementation depends on UI
    console.log("Updating complaints list");
  }

  function updateAdminStats() {
    // Update admin statistics - implementation depends on UI
    console.log("Updating admin stats");
  }

  // ==================== PUBLIC API ====================
  return {
    init,
    login,
    logout,
    showNotification,
    showToast,
    getCurrentUser: () => currentUser,
    getAuthToken: () => authToken,
    getDeviceId: () => deviceId,
    getSyncManager: () => syncManager,
  };
})();

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

// Global functions for compatibility
window.App = App;
