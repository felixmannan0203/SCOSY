// ==================== CROSS-DEVICE SYNC MANAGER ====================

class SyncManager {
    constructor() {
        this.socket = null;
        this.deviceId = null;
        this.userId = null;
        this.userType = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.lastSyncTime = null;
        this.conflictResolver = new ConflictResolver();
        this.offlineStorage = new OfflineStorage();
        
        this.init();
    }

    // Initialize sync manager
    init() {
        this.setupEventListeners();
        this.detectDevice();
        this.loadOfflineQueue();
    }

    // Setup event listeners for online/offline detection
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnlineStatus();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOfflineStatus();
        });

        // Listen for visibility changes to sync when app becomes active
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                this.syncPendingChanges();
            }
        });
    }

    // Detect device capabilities and type
    detectDevice() {
        const deviceInfo = {
            type: this.getDeviceType(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenSize: {
                width: window.screen.width,
                height: window.screen.height
            },
            hasTouch: 'ontouchstart' in window,
            pixelRatio: window.devicePixelRatio || 1,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            } : null
        };

        this.deviceInfo = deviceInfo;
        return deviceInfo;
    }

    // Determine device type based on screen size and capabilities
    getDeviceType() {
        const width = window.innerWidth;
        const hasTouch = 'ontouchstart' in window;
        
        if (width <= 768) {
            return 'mobile';
        } else if (width <= 1024 && hasTouch) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    // Initialize connection with Socket.IO
    async initializeConnection(userId, userType, token) {
        try {
            this.userId = userId;
            this.userType = userType;
            
            // Register device if not already registered
            if (!this.deviceId) {
                await this.registerDevice(token);
            }

            // Initialize Socket.IO connection
            this.socket = io({
                auth: {
                    token: token,
                    deviceId: this.deviceId,
                    userId: this.userId,
                    userType: this.userType
                }
            });

            this.setupSocketListeners();
            
            // Join user-specific room for cross-device sync
            this.socket.emit('join-room', {
                userId: this.userId,
                deviceId: this.deviceId
            });

            console.log('✅ Sync Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize sync manager:', error);
            return false;
        }
    }

    // Register device with backend
    async registerDevice(token) {
        try {
            const response = await fetch('/api/devices/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    deviceInfo: this.deviceInfo
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.deviceId = data.deviceId;
                localStorage.setItem('scosy_device_id', this.deviceId);
                console.log('✅ Device registered:', this.deviceId);
            } else {
                throw new Error('Failed to register device');
            }
        } catch (error) {
            console.error('❌ Device registration failed:', error);
            // Generate fallback device ID
            this.deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('scosy_device_id', this.deviceId);
        }
    }

    // Setup Socket.IO event listeners
    setupSocketListeners() {
        // Handle cross-device data sync
        this.socket.on('data-synced', (data) => {
            this.handleIncomingSync(data);
        });

        // Handle user preferences sync
        this.socket.on('preferences-synced', (data) => {
            this.handlePreferencesSync(data);
        });

        // Handle complaint sync
        this.socket.on('complaint-synced', (data) => {
            this.handleComplaintSync(data);
        });

        // Handle device status changes
        this.socket.on('device-status-changed', (data) => {
            this.handleDeviceStatusChange(data);
        });

        // Handle offline queue sync completion
        this.socket.on('offline-queue-synced', (data) => {
            this.handleOfflineQueueSynced(data);
        });

        // Handle connection events
        this.socket.on('connect', () => {
            console.log('🔗 Socket connected');
            this.syncPendingChanges();
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });
    }

    // Sync user data across devices
    async syncUserData(data, syncType = 'general') {
        const syncPayload = {
            userId: this.userId,
            deviceId: this.deviceId,
            syncType: syncType,
            payload: data,
            timestamp: new Date().toISOString()
        };

        if (this.isOnline && this.socket?.connected) {
            // Send immediately if online
            this.socket.emit('sync-data', syncPayload);
            this.lastSyncTime = syncPayload.timestamp;
        } else {
            // Queue for later if offline
            this.queueForSync(syncPayload);
        }
    }

    // Sync user preferences
    async syncPreferences(preferences) {
        const syncPayload = {
            userId: this.userId,
            deviceId: this.deviceId,
            userType: this.userType,
            preferences: preferences,
            timestamp: new Date().toISOString()
        };

        if (this.isOnline && this.socket?.connected) {
            this.socket.emit('sync-preferences', syncPayload);
        } else {
            this.queueForSync({
                type: 'preferences',
                data: preferences,
                timestamp: syncPayload.timestamp,
                deviceId: this.deviceId
            });
        }

        // Store locally
        localStorage.setItem('scosy_user_preferences', JSON.stringify(preferences));
    }

    // Sync complaint data
    async syncComplaint(complaint, action = 'created') {
        const syncPayload = {
            userId: this.userId,
            complaint: complaint,
            action: action,
            deviceId: this.deviceId,
            timestamp: new Date().toISOString()
        };

        if (this.isOnline && this.socket?.connected) {
            this.socket.emit('sync-complaint', syncPayload);
        } else {
            this.queueForSync({
                type: 'complaint',
                data: complaint,
                action: action,
                timestamp: syncPayload.timestamp,
                deviceId: this.deviceId
            });
        }
    }

    // Handle incoming sync data
    handleIncomingSync(data) {
        // Don't process sync from same device
        if (data.sourceDevice === this.deviceId) return;

        console.log('📥 Received sync data:', data.syncType);

        // Apply sync based on type
        switch (data.syncType) {
            case 'preferences':
                this.applyPreferencesSync(data.payload);
                break;
            case 'complaint':
                this.applyComplaintSync(data.payload);
                break;
            case 'theme':
                this.applyThemeSync(data.payload);
                break;
            default:
                console.log('Unknown sync type:', data.syncType);
        }

        // Update last sync time
        this.lastSyncTime = data.timestamp;
    }

    // Handle preferences sync from other devices
    handlePreferencesSync(data) {
        if (data.sourceDevice === this.deviceId) return;

        console.log('⚙️ Syncing preferences from device:', data.sourceDevice);
        
        // Apply preferences
        this.applyPreferencesSync(data.preferences);
        
        // Store locally
        localStorage.setItem('scosy_user_preferences', JSON.stringify(data.preferences));
    }

    // Handle complaint sync from other devices
    handleComplaintSync(data) {
        if (data.sourceDevice === this.deviceId) return;

        console.log('📋 Syncing complaint:', data.action);
        
        // Trigger UI update based on action
        if (window.App && typeof window.App.handleComplaintSync === 'function') {
            window.App.handleComplaintSync(data.complaint, data.action);
        }
    }

    // Apply preferences sync
    applyPreferencesSync(preferences) {
        // Apply theme if changed
        if (preferences.theme && window.ThemeController) {
            window.ThemeController.setTheme(preferences.theme);
        }

        // Apply other preferences
        if (preferences.notifications) {
            // Handle notification preferences
        }

        // Trigger preference update event
        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
            detail: preferences
        }));
    }

    // Apply theme sync
    applyThemeSync(themeData) {
        if (window.ThemeController) {
            window.ThemeController.setTheme(themeData.theme);
        }
    }

    // Queue data for sync when back online
    queueForSync(data) {
        this.syncQueue.push(data);
        this.saveOfflineQueue();
        console.log('📦 Queued for sync:', data.type || 'data');
    }

    // Handle online status
    handleOnlineStatus() {
        console.log('🌐 Back online - syncing queued data');
        this.syncPendingChanges();
        
        // Update UI to show online status
        this.updateConnectionStatus(true);
    }

    // Handle offline status
    handleOfflineStatus() {
        console.log('📴 Gone offline - queueing changes');
        
        // Update UI to show offline status
        this.updateConnectionStatus(false);
    }

    // Sync all pending changes
    async syncPendingChanges() {
        if (!this.isOnline || !this.socket?.connected || this.syncQueue.length === 0) {
            return;
        }

        console.log(`🔄 Syncing ${this.syncQueue.length} queued items`);

        // Send offline queue to server
        this.socket.emit('sync-offline-queue', {
            userId: this.userId,
            queuedActions: this.syncQueue
        });

        // Clear queue after sending
        this.syncQueue = [];
        this.saveOfflineQueue();
    }

    // Handle offline queue sync completion
    handleOfflineQueueSynced(data) {
        console.log(`✅ Synced ${data.processedCount} offline items`);
        
        // Show success message
        if (window.toast) {
            window.toast(`Synced ${data.processedCount} offline changes`, 'success');
        }
    }

    // Save offline queue to localStorage
    saveOfflineQueue() {
        try {
            localStorage.setItem('scosy_sync_queue', JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    // Load offline queue from localStorage
    loadOfflineQueue() {
        try {
            const saved = localStorage.getItem('scosy_sync_queue');
            if (saved) {
                this.syncQueue = JSON.parse(saved);
                console.log(`📦 Loaded ${this.syncQueue.length} queued items`);
            }
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.syncQueue = [];
        }
    }

    // Update connection status in UI
    updateConnectionStatus(isOnline) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = isOnline ? 'status-online' : 'status-offline';
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
        }

        // Update sync indicators
        const syncIndicators = document.querySelectorAll('.sync-indicator');
        syncIndicators.forEach(indicator => {
            indicator.classList.toggle('syncing', !isOnline);
        });
    }

    // Get sync status
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isConnected: this.socket?.connected || false,
            queuedItems: this.syncQueue.length,
            lastSyncTime: this.lastSyncTime,
            deviceId: this.deviceId
        };
    }

    // Disconnect and cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Save any pending queue
        this.saveOfflineQueue();
        
        console.log('🔌 Sync Manager disconnected');
    }
}

// ==================== CONFLICT RESOLVER ====================
class ConflictResolver {
    constructor() {
        this.strategy = 'last-write-wins'; // Default strategy
    }

    // Resolve conflicts between data versions
    resolveConflict(localData, remoteData, conflictType = 'general') {
        switch (this.strategy) {
            case 'last-write-wins':
                return this.lastWriteWins(localData, remoteData);
            case 'merge':
                return this.mergeData(localData, remoteData, conflictType);
            default:
                return this.lastWriteWins(localData, remoteData);
        }
    }

    // Last write wins strategy
    lastWriteWins(localData, remoteData) {
        const localTime = new Date(localData.timestamp || localData.updatedAt || 0);
        const remoteTime = new Date(remoteData.timestamp || remoteData.updatedAt || 0);
        
        return remoteTime > localTime ? remoteData : localData;
    }

    // Merge data strategy for preferences
    mergeData(localData, remoteData, conflictType) {
        if (conflictType === 'preferences') {
            // Merge preferences, with remote taking precedence for conflicts
            return {
                ...localData,
                ...remoteData,
                timestamp: Math.max(
                    new Date(localData.timestamp || 0).getTime(),
                    new Date(remoteData.timestamp || 0).getTime()
                )
            };
        }
        
        // Default to last write wins for other types
        return this.lastWriteWins(localData, remoteData);
    }
}

// ==================== OFFLINE STORAGE ====================
class OfflineStorage {
    constructor() {
        this.dbName = 'ScosyOfflineDB';
        this.version = 1;
        this.db = null;
        this.init();
    }

    // Initialize IndexedDB
    async init() {
        try {
            this.db = await this.openDB();
            console.log('💾 Offline storage initialized');
        } catch (error) {
            console.error('Failed to initialize offline storage:', error);
        }
    }

    // Open IndexedDB connection
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('complaints')) {
                    const complaintsStore = db.createObjectStore('complaints', { keyPath: 'id' });
                    complaintsStore.createIndex('timestamp', 'timestamp');
                }
                
                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences', { keyPath: 'userId' });
                }
                
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    queueStore.createIndex('timestamp', 'timestamp');
                }
            };
        });
    }

    // Store data offline
    async storeOffline(storeName, data) {
        if (!this.db) return false;
        
        try {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            await store.put(data);
            return true;
        } catch (error) {
            console.error('Failed to store offline data:', error);
            return false;
        }
    }

    // Retrieve offline data
    async getOfflineData(storeName, key) {
        if (!this.db) return null;
        
        try {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to get offline data:', error);
            return null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SyncManager, ConflictResolver, OfflineStorage };
} else {
    window.SyncManager = SyncManager;
    window.ConflictResolver = ConflictResolver;
    window.OfflineStorage = OfflineStorage;
}