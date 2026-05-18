// ==================== COMPREHENSIVE TESTING SUITE ====================

class MultiDeviceTestSuite {
    constructor() {
        this.testResults = [];
        this.currentTest = null;
        this.testEnvironment = this.detectTestEnvironment();
        this.mockData = new MockDataGenerator();
        
        this.init();
    }

    // Initialize test suite
    init() {
        this.setupTestEnvironment();
        this.createTestUI();
        console.log('🧪 Multi-Device Test Suite initialized');
    }

    // Detect test environment
    detectTestEnvironment() {
        return {
            userAgent: navigator.userAgent,
            screenSize: {
                width: window.screen.width,
                height: window.screen.height
            },
            viewportSize: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            devicePixelRatio: window.devicePixelRatio,
            hasTouch: 'ontouchstart' in window,
            platform: navigator.platform,
            connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
            isOnline: navigator.onLine,
            supportsServiceWorker: 'serviceWorker' in navigator,
            supportsIndexedDB: 'indexedDB' in window,
            supportsWebSockets: 'WebSocket' in window
        };
    }

    // Setup test environment
    setupTestEnvironment() {
        // Create test container
        this.testContainer = document.createElement('div');
        this.testContainer.id = 'test-container';
        this.testContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            z-index: 10000;
            overflow: hidden;
            display: none;
        `;
        document.body.appendChild(this.testContainer);

        // Add global test trigger
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                this.toggleTestUI();
            }
        });
    }

    // Create test UI
    createTestUI() {
        this.testContainer.innerHTML = `
            <div class="test-header" style="padding: 12px; background: var(--primary); color: white; font-weight: 600;">
                Multi-Device Tests
                <button id="closeTests" style="float: right; background: none; border: none; color: white; cursor: pointer;">×</button>
            </div>
            <div class="test-content" style="padding: 12px; max-height: 350px; overflow-y: auto;">
                <div class="test-categories">
                    <button class="test-category-btn" data-category="responsive">Responsive Design</button>
                    <button class="test-category-btn" data-category="touch">Touch Interactions</button>
                    <button class="test-category-btn" data-category="sync">Cross-Device Sync</button>
                    <button class="test-category-btn" data-category="offline">Offline Functionality</button>
                    <button class="test-category-btn" data-category="performance">Performance</button>
                    <button class="test-category-btn" data-category="all">Run All Tests</button>
                </div>
                <div id="testResults" class="test-results" style="margin-top: 12px;"></div>
            </div>
        `;

        // Add event listeners
        document.getElementById('closeTests').addEventListener('click', () => {
            this.toggleTestUI();
        });

        document.querySelectorAll('.test-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.runTestCategory(category);
            });
        });

        // Add CSS for test UI
        const style = document.createElement('style');
        style.textContent = `
            .test-category-btn {
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin-bottom: 4px;
                background: var(--bg-light);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                color: var(--text);
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.2s ease;
            }
            
            .test-category-btn:hover {
                background: var(--primary);
                color: white;
            }
            
            .test-result {
                padding: 8px;
                margin-bottom: 4px;
                border-radius: var(--radius-sm);
                font-size: 0.8rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .test-result.pass {
                background: rgba(16, 185, 129, 0.1);
                color: var(--success);
                border: 1px solid rgba(16, 185, 129, 0.3);
            }
            
            .test-result.fail {
                background: rgba(239, 68, 68, 0.1);
                color: var(--danger);
                border: 1px solid rgba(239, 68, 68, 0.3);
            }
            
            .test-result.running {
                background: rgba(245, 158, 11, 0.1);
                color: var(--warning);
                border: 1px solid rgba(245, 158, 11, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Toggle test UI visibility
    toggleTestUI() {
        const isVisible = this.testContainer.style.display !== 'none';
        this.testContainer.style.display = isVisible ? 'none' : 'block';
    }

    // Run test category
    async runTestCategory(category) {
        const resultsContainer = document.getElementById('testResults');
        resultsContainer.innerHTML = '<div class="test-result running">Running tests...</div>';

        try {
            let tests = [];
            
            switch (category) {
                case 'responsive':
                    tests = await this.runResponsiveTests();
                    break;
                case 'touch':
                    tests = await this.runTouchTests();
                    break;
                case 'sync':
                    tests = await this.runSyncTests();
                    break;
                case 'offline':
                    tests = await this.runOfflineTests();
                    break;
                case 'performance':
                    tests = await this.runPerformanceTests();
                    break;
                case 'all':
                    tests = await this.runAllTests();
                    break;
            }

            this.displayTestResults(tests);
        } catch (error) {
            console.error('Test execution failed:', error);
            resultsContainer.innerHTML = '<div class="test-result fail">Test execution failed</div>';
        }
    }

    // Run responsive design tests
    async runResponsiveTests() {
        const tests = [];

        // Test viewport meta tag
        tests.push(await this.testViewportMetaTag());
        
        // Test breakpoint detection
        tests.push(await this.testBreakpointDetection());
        
        // Test responsive layout
        tests.push(await this.testResponsiveLayout());
        
        // Test mobile menu functionality
        tests.push(await this.testMobileMenu());
        
        // Test touch target sizes
        tests.push(await this.testTouchTargetSizes());

        return tests;
    }

    // Test viewport meta tag
    async testViewportMetaTag() {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const hasViewport = viewportMeta && viewportMeta.content.includes('width=device-width');
        
        return {
            name: 'Viewport Meta Tag',
            passed: hasViewport,
            message: hasViewport ? 'Viewport meta tag configured correctly' : 'Missing or incorrect viewport meta tag'
        };
    }

    // Test breakpoint detection
    async testBreakpointDetection() {
        const responsiveManager = window.ResponsiveManager;
        const hasBreakpointDetection = responsiveManager && typeof responsiveManager.getDeviceInfo === 'function';
        
        return {
            name: 'Breakpoint Detection',
            passed: hasBreakpointDetection,
            message: hasBreakpointDetection ? 'Breakpoint detection working' : 'Breakpoint detection not available'
        };
    }

    // Test responsive layout
    async testResponsiveLayout() {
        const dashboardLayout = document.querySelector('.dashboard-layout');
        const sidebar = document.querySelector('.sidebar');
        
        const hasResponsiveLayout = dashboardLayout && sidebar;
        
        return {
            name: 'Responsive Layout',
            passed: hasResponsiveLayout,
            message: hasResponsiveLayout ? 'Responsive layout elements found' : 'Responsive layout elements missing'
        };
    }

    // Test mobile menu
    async testMobileMenu() {
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const hasMobileMenu = mobileToggle !== null;
        
        return {
            name: 'Mobile Menu',
            passed: hasMobileMenu,
            message: hasMobileMenu ? 'Mobile menu toggle found' : 'Mobile menu toggle missing'
        };
    }

    // Test touch target sizes
    async testTouchTargetSizes() {
        const interactiveElements = document.querySelectorAll('button, .btn, .menu-list a');
        let minSizeViolations = 0;
        
        interactiveElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 44 || rect.height < 44) {
                minSizeViolations++;
            }
        });
        
        const passed = minSizeViolations === 0;
        
        return {
            name: 'Touch Target Sizes',
            passed: passed,
            message: passed ? 'All touch targets meet minimum size' : `${minSizeViolations} elements below 44px minimum`
        };
    }

    // Run touch interaction tests
    async runTouchTests() {
        const tests = [];

        tests.push(await this.testTouchSupport());
        tests.push(await this.testTouchFeedback());
        tests.push(await this.testGestureSupport());
        tests.push(await this.testPullToRefresh());

        return tests;
    }

    // Test touch support detection
    async testTouchSupport() {
        const hasTouch = 'ontouchstart' in window;
        const touchController = window.EnhancedTouchController || window.TouchController;
        
        return {
            name: 'Touch Support Detection',
            passed: hasTouch && touchController,
            message: hasTouch ? 'Touch support detected and controller available' : 'Touch support not detected'
        };
    }

    // Test touch feedback
    async testTouchFeedback() {
        const touchFeedbackElements = document.querySelectorAll('.touch-feedback');
        const hasTouchFeedback = touchFeedbackElements.length > 0;
        
        return {
            name: 'Touch Feedback',
            passed: hasTouchFeedback,
            message: hasTouchFeedback ? 'Touch feedback elements found' : 'No touch feedback elements'
        };
    }

    // Test gesture support
    async testGestureSupport() {
        const touchController = window.EnhancedTouchController;
        const hasGestureSupport = touchController && typeof touchController.handleSwipeLeft === 'function';
        
        return {
            name: 'Gesture Support',
            passed: hasGestureSupport,
            message: hasGestureSupport ? 'Gesture support available' : 'Gesture support not available'
        };
    }

    // Test pull-to-refresh
    async testPullToRefresh() {
        const pullToRefreshElement = document.querySelector('.pull-to-refresh-indicator');
        const hasPullToRefresh = pullToRefreshElement !== null;
        
        return {
            name: 'Pull-to-Refresh',
            passed: hasPullToRefresh,
            message: hasPullToRefresh ? 'Pull-to-refresh implemented' : 'Pull-to-refresh not implemented'
        };
    }

    // Run cross-device sync tests
    async runSyncTests() {
        const tests = [];

        tests.push(await this.testSyncManagerInitialization());
        tests.push(await this.testSocketConnection());
        tests.push(await this.testDeviceRegistration());
        tests.push(await this.testDataSynchronization());

        return tests;
    }

    // Test sync manager initialization
    async testSyncManagerInitialization() {
        const syncManager = window.SyncManager;
        const hasSyncManager = syncManager && typeof syncManager === 'function';
        
        return {
            name: 'Sync Manager Initialization',
            passed: hasSyncManager,
            message: hasSyncManager ? 'Sync Manager class available' : 'Sync Manager not available'
        };
    }

    // Test socket connection
    async testSocketConnection() {
        const hasSocketIO = typeof io !== 'undefined';
        
        return {
            name: 'Socket.IO Connection',
            passed: hasSocketIO,
            message: hasSocketIO ? 'Socket.IO library loaded' : 'Socket.IO library not loaded'
        };
    }

    // Test device registration
    async testDeviceRegistration() {
        const deviceId = localStorage.getItem('scosy_device_id');
        const hasDeviceId = deviceId !== null;
        
        return {
            name: 'Device Registration',
            passed: hasDeviceId,
            message: hasDeviceId ? 'Device ID found in storage' : 'No device ID in storage'
        };
    }

    // Test data synchronization
    async testDataSynchronization() {
        const syncQueue = localStorage.getItem('scosy_sync_queue');
        const hasSyncQueue = syncQueue !== null;
        
        return {
            name: 'Data Synchronization',
            passed: hasSyncQueue,
            message: hasSyncQueue ? 'Sync queue initialized' : 'Sync queue not initialized'
        };
    }

    // Run offline functionality tests
    async runOfflineTests() {
        const tests = [];

        tests.push(await this.testServiceWorkerRegistration());
        tests.push(await this.testCacheStorage());
        tests.push(await this.testOfflineDetection());
        tests.push(await this.testIndexedDBSupport());

        return tests;
    }

    // Test service worker registration
    async testServiceWorkerRegistration() {
        const hasServiceWorker = 'serviceWorker' in navigator;
        let isRegistered = false;
        
        if (hasServiceWorker) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                isRegistered = registration !== undefined;
            } catch (error) {
                console.error('Service worker check failed:', error);
            }
        }
        
        return {
            name: 'Service Worker Registration',
            passed: hasServiceWorker && isRegistered,
            message: hasServiceWorker ? 
                (isRegistered ? 'Service worker registered' : 'Service worker not registered') :
                'Service worker not supported'
        };
    }

    // Test cache storage
    async testCacheStorage() {
        const hasCacheAPI = 'caches' in window;
        let hasCaches = false;
        
        if (hasCacheAPI) {
            try {
                const cacheNames = await caches.keys();
                hasCaches = cacheNames.length > 0;
            } catch (error) {
                console.error('Cache check failed:', error);
            }
        }
        
        return {
            name: 'Cache Storage',
            passed: hasCacheAPI && hasCaches,
            message: hasCacheAPI ? 
                (hasCaches ? 'Caches found' : 'No caches found') :
                'Cache API not supported'
        };
    }

    // Test offline detection
    async testOfflineDetection() {
        const hasOnlineEvents = 'onLine' in navigator;
        const connectionStatus = document.getElementById('connectionStatus');
        
        return {
            name: 'Offline Detection',
            passed: hasOnlineEvents && connectionStatus,
            message: hasOnlineEvents ? 'Online/offline detection available' : 'Online/offline detection not available'
        };
    }

    // Test IndexedDB support
    async testIndexedDBSupport() {
        const hasIndexedDB = 'indexedDB' in window;
        
        return {
            name: 'IndexedDB Support',
            passed: hasIndexedDB,
            message: hasIndexedDB ? 'IndexedDB supported' : 'IndexedDB not supported'
        };
    }

    // Run performance tests
    async runPerformanceTests() {
        const tests = [];

        tests.push(await this.testPageLoadTime());
        tests.push(await this.testImageOptimization());
        tests.push(await this.testLazyLoading());
        tests.push(await this.testBundleSize());

        return tests;
    }

    // Test page load time
    async testPageLoadTime() {
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        const loadTime = navigationTiming ? navigationTiming.loadEventEnd - navigationTiming.fetchStart : 0;
        const passed = loadTime < 3000; // 3 seconds threshold
        
        return {
            name: 'Page Load Time',
            passed: passed,
            message: `Page loaded in ${Math.round(loadTime)}ms ${passed ? '(Good)' : '(Slow)'}`
        };
    }

    // Test image optimization
    async testImageOptimization() {
        const images = document.querySelectorAll('img');
        const lazyImages = document.querySelectorAll('img[data-src]');
        const hasLazyImages = lazyImages.length > 0;
        
        return {
            name: 'Image Optimization',
            passed: hasLazyImages,
            message: hasLazyImages ? 
                `${lazyImages.length}/${images.length} images use lazy loading` :
                'No lazy loading detected'
        };
    }

    // Test lazy loading
    async testLazyLoading() {
        const lazyElements = document.querySelectorAll('[data-lazy]');
        const hasLazyElements = lazyElements.length > 0;
        
        return {
            name: 'Lazy Loading',
            passed: hasLazyElements,
            message: hasLazyElements ? 
                `${lazyElements.length} elements use lazy loading` :
                'No lazy loading elements found'
        };
    }

    // Test bundle size
    async testBundleSize() {
        const scripts = document.querySelectorAll('script[src]');
        const styles = document.querySelectorAll('link[rel="stylesheet"]');
        const totalResources = scripts.length + styles.length;
        const passed = totalResources < 10; // Reasonable threshold
        
        return {
            name: 'Bundle Size',
            passed: passed,
            message: `${totalResources} external resources ${passed ? '(Optimized)' : '(Too many)'}`
        };
    }

    // Run all tests
    async runAllTests() {
        const allTests = [];
        
        const responsiveTests = await this.runResponsiveTests();
        const touchTests = await this.runTouchTests();
        const syncTests = await this.runSyncTests();
        const offlineTests = await this.runOfflineTests();
        const performanceTests = await this.runPerformanceTests();
        
        allTests.push(...responsiveTests, ...touchTests, ...syncTests, ...offlineTests, ...performanceTests);
        
        return allTests;
    }

    // Display test results
    displayTestResults(tests) {
        const resultsContainer = document.getElementById('testResults');
        const passedTests = tests.filter(test => test.passed).length;
        const totalTests = tests.length;
        
        let html = `
            <div class="test-summary" style="margin-bottom: 12px; padding: 8px; background: var(--bg-light); border-radius: var(--radius-sm);">
                <strong>Results: ${passedTests}/${totalTests} tests passed</strong>
            </div>
        `;
        
        tests.forEach(test => {
            html += `
                <div class="test-result ${test.passed ? 'pass' : 'fail'}">
                    <span>${test.name}</span>
                    <span>${test.passed ? '✓' : '✗'}</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px; padding-left: 8px;">
                    ${test.message}
                </div>
            `;
        });
        
        resultsContainer.innerHTML = html;
        
        // Store results
        this.testResults = tests;
        
        // Log summary
        console.log(`🧪 Test Results: ${passedTests}/${totalTests} passed`);
        tests.forEach(test => {
            console.log(`${test.passed ? '✓' : '✗'} ${test.name}: ${test.message}`);
        });
    }

    // Export test results
    exportResults() {
        const results = {
            timestamp: new Date().toISOString(),
            environment: this.testEnvironment,
            tests: this.testResults,
            summary: {
                total: this.testResults.length,
                passed: this.testResults.filter(test => test.passed).length,
                failed: this.testResults.filter(test => !test.passed).length
            }
        };
        
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scosy-test-results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ==================== MOCK DATA GENERATOR ====================
class MockDataGenerator {
    constructor() {
        this.users = this.generateMockUsers();
        this.complaints = this.generateMockComplaints();
        this.devices = this.generateMockDevices();
    }

    generateMockUsers() {
        return [
            {
                id: 'user1',
                name: 'John Doe',
                matric: 'PLASU/2024/FNAS/0001',
                email: 'john.doe@plasu.edu.ng',
                userType: 'student'
            },
            {
                id: 'admin1',
                name: 'Admin User',
                staffId: 'admin',
                email: 'admin@plasu.edu.ng',
                userType: 'admin'
            }
        ];
    }

    generateMockComplaints() {
        return [
            {
                id: 'complaint1',
                subject: 'Network connectivity issues',
                category: 'infrastructure',
                priority: 'high',
                status: 'pending',
                submitterId: 'user1'
            },
            {
                id: 'complaint2',
                subject: 'Course registration problem',
                category: 'academic',
                priority: 'medium',
                status: 'resolved',
                submitterId: 'user1'
            }
        ];
    }

    generateMockDevices() {
        return [
            {
                id: 'device1',
                type: 'mobile',
                platform: 'iOS',
                lastActive: new Date().toISOString()
            },
            {
                id: 'device2',
                type: 'desktop',
                platform: 'Windows',
                lastActive: new Date().toISOString()
            }
        ];
    }
}

// Initialize test suite
document.addEventListener('DOMContentLoaded', () => {
    window.MultiDeviceTestSuite = new MultiDeviceTestSuite();
    
    // Add test trigger info to console
    console.log('🧪 Multi-Device Test Suite loaded. Press Ctrl+Shift+T to open test panel.');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MultiDeviceTestSuite, MockDataGenerator };
}