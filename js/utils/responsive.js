// ==================== RESPONSIVE LAYOUT MANAGER ====================

class ResponsiveLayoutManager {
    constructor() {
        this.currentBreakpoint = 'desktop';
        this.deviceCapabilities = {};
        this.breakpoints = {
            mobile: { min: 0, max: 767 },
            tablet: { min: 768, max: 1023 },
            desktop: { min: 1024, max: Infinity }
        };
        this.listeners = [];
        this.touchController = new TouchController();
        
        this.init();
    }

    // Initialize responsive manager
    init() {
        this.detectDevice();
        this.setupEventListeners();
        this.adaptLayout();
        this.initializeMobileMenu();
        
        console.log('📱 Responsive Layout Manager initialized');
    }

    // Detect device capabilities
    detectDevice() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.deviceCapabilities = {
            screenWidth: width,
            screenHeight: height,
            pixelRatio: window.devicePixelRatio || 1,
            hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            isRetina: window.devicePixelRatio > 1,
            orientation: width > height ? 'landscape' : 'portrait',
            platform: this.detectPlatform(),
            connectionType: this.getConnectionType(),
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            highContrast: window.matchMedia('(prefers-contrast: high)').matches
        };

        // Determine device type
        if (width <= this.breakpoints.mobile.max) {
            this.deviceCapabilities.type = 'mobile';
            this.currentBreakpoint = 'mobile';
        } else if (width <= this.breakpoints.tablet.max) {
            this.deviceCapabilities.type = 'tablet';
            this.currentBreakpoint = 'tablet';
        } else {
            this.deviceCapabilities.type = 'desktop';
            this.currentBreakpoint = 'desktop';
        }

        console.log('📱 Device detected:', this.deviceCapabilities);
    }

    // Detect platform
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
        if (/android/.test(userAgent)) return 'android';
        if (/windows/.test(userAgent)) return 'windows';
        if (/mac/.test(userAgent)) return 'mac';
        if (/linux/.test(userAgent)) return 'linux';
        
        return 'unknown';
    }

    // Get connection type
    getConnectionType() {
        if ('connection' in navigator) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return null;
    }

    // Setup event listeners
    setupEventListeners() {
        // Window resize listener
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 150);
        });

        // Orientation change listener
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // Media query listeners
        Object.keys(this.breakpoints).forEach(breakpoint => {
            const mediaQuery = this.createMediaQuery(breakpoint);
            mediaQuery.addListener((e) => {
                if (e.matches) {
                    this.handleBreakpointChange(breakpoint);
                }
            });
        });

        // Reduced motion preference listener
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addListener((e) => {
            this.deviceCapabilities.reducedMotion = e.matches;
            this.adaptAccessibility();
        });

        // High contrast preference listener
        const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
        highContrastQuery.addListener((e) => {
            this.deviceCapabilities.highContrast = e.matches;
            this.adaptAccessibility();
        });
    }

    // Create media query for breakpoint
    createMediaQuery(breakpoint) {
        const bp = this.breakpoints[breakpoint];
        let query = '';
        
        if (bp.min > 0 && bp.max < Infinity) {
            query = `(min-width: ${bp.min}px) and (max-width: ${bp.max}px)`;
        } else if (bp.min > 0) {
            query = `(min-width: ${bp.min}px)`;
        } else {
            query = `(max-width: ${bp.max}px)`;
        }
        
        return window.matchMedia(query);
    }

    // Handle window resize
    handleResize() {
        const oldBreakpoint = this.currentBreakpoint;
        this.detectDevice();
        
        if (oldBreakpoint !== this.currentBreakpoint) {
            this.handleBreakpointChange(this.currentBreakpoint);
        }
        
        this.adaptLayout();
        this.notifyListeners('resize', this.deviceCapabilities);
    }

    // Handle orientation change
    handleOrientationChange() {
        const oldOrientation = this.deviceCapabilities.orientation;
        this.detectDevice();
        
        if (oldOrientation !== this.deviceCapabilities.orientation) {
            this.adaptLayout();
            this.notifyListeners('orientationchange', this.deviceCapabilities);
            
            // Handle specific orientation changes
            if (this.deviceCapabilities.type === 'mobile') {
                this.handleMobileOrientationChange();
            }
        }
    }

    // Handle breakpoint changes
    handleBreakpointChange(newBreakpoint) {
        const oldBreakpoint = this.currentBreakpoint;
        this.currentBreakpoint = newBreakpoint;
        
        console.log(`📱 Breakpoint changed: ${oldBreakpoint} → ${newBreakpoint}`);
        
        this.adaptLayout(newBreakpoint);
        this.notifyListeners('breakpointchange', {
            old: oldBreakpoint,
            new: newBreakpoint,
            capabilities: this.deviceCapabilities
        });
    }

    // Adapt layout for current breakpoint
    adaptLayout(breakpoint = this.currentBreakpoint) {
        document.body.setAttribute('data-device-type', this.deviceCapabilities.type);
        document.body.setAttribute('data-breakpoint', breakpoint);
        
        // Apply touch optimizations
        if (this.deviceCapabilities.hasTouch) {
            this.optimizeForTouch(true);
        }

        // Adapt specific components
        this.adaptNavigation(breakpoint);
        this.adaptSidebar(breakpoint);
        this.adaptContent(breakpoint);
        this.adaptForms(breakpoint);
        
        // Handle accessibility
        this.adaptAccessibility();
        
        console.log(`📱 Layout adapted for ${breakpoint}`);
    }

    // Optimize for touch devices
    optimizeForTouch(enabled) {
        const body = document.body;
        
        if (enabled) {
            body.classList.add('touch-device');
            
            // Add touch feedback to interactive elements
            const interactiveElements = document.querySelectorAll('button, .btn, .menu-list a, .action-btn');
            interactiveElements.forEach(element => {
                element.classList.add('touch-feedback');
            });
            
            // Initialize touch controller
            this.touchController.init();
        } else {
            body.classList.remove('touch-device');
        }
    }

    // Adapt navigation for different breakpoints
    adaptNavigation(breakpoint) {
        const topNav = document.querySelector('.top-nav');
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        
        if (!topNav) return;
        
        switch (breakpoint) {
            case 'mobile':
                if (mobileToggle) {
                    mobileToggle.style.display = 'flex';
                }
                topNav.classList.add('mobile-nav');
                break;
                
            case 'tablet':
                if (mobileToggle) {
                    mobileToggle.style.display = 'none';
                }
                topNav.classList.remove('mobile-nav');
                break;
                
            case 'desktop':
                if (mobileToggle) {
                    mobileToggle.style.display = 'none';
                }
                topNav.classList.remove('mobile-nav');
                break;
        }
    }

    // Adapt sidebar for different breakpoints
    adaptSidebar(breakpoint) {
        const sidebar = document.querySelector('.sidebar');
        const dashboardLayout = document.querySelector('.dashboard-layout');
        
        if (!sidebar || !dashboardLayout) return;
        
        switch (breakpoint) {
            case 'mobile':
                sidebar.classList.add('mobile-sidebar');
                this.createSidebarOverlay();
                break;
                
            case 'tablet':
                sidebar.classList.remove('mobile-sidebar');
                this.removeSidebarOverlay();
                break;
                
            case 'desktop':
                sidebar.classList.remove('mobile-sidebar');
                this.removeSidebarOverlay();
                break;
        }
    }

    // Adapt content area
    adaptContent(breakpoint) {
        const contentArea = document.querySelector('.content-area');
        const statsGrid = document.querySelector('.stats-grid');
        const dashboardGrid = document.querySelector('.dashboard-grid');
        
        if (contentArea) {
            contentArea.setAttribute('data-breakpoint', breakpoint);
        }
        
        // Adapt grids based on breakpoint
        if (statsGrid) {
            statsGrid.className = `stats-grid stats-${breakpoint}`;
        }
        
        if (dashboardGrid) {
            dashboardGrid.className = `dashboard-grid dashboard-${breakpoint}`;
        }
    }

    // Adapt forms for touch devices
    adaptForms(breakpoint) {
        const inputs = document.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            if (breakpoint === 'mobile' && this.deviceCapabilities.hasTouch) {
                // Prevent zoom on iOS
                if (this.deviceCapabilities.platform === 'ios') {
                    input.style.fontSize = '16px';
                }
                
                // Add touch-friendly classes
                input.classList.add('touch-optimized');
            } else {
                input.classList.remove('touch-optimized');
            }
        });
    }

    // Handle accessibility adaptations
    adaptAccessibility() {
        const body = document.body;
        
        // Reduced motion
        if (this.deviceCapabilities.reducedMotion) {
            body.classList.add('reduced-motion');
        } else {
            body.classList.remove('reduced-motion');
        }
        
        // High contrast
        if (this.deviceCapabilities.highContrast) {
            body.classList.add('high-contrast');
        } else {
            body.classList.remove('high-contrast');
        }
    }

    // Initialize mobile menu functionality
    initializeMobileMenu() {
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
    }

    // Toggle mobile menu
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            const isOpen = sidebar.classList.contains('mobile-open');
            
            if (isOpen) {
                this.closeMobileMenu();
            } else {
                this.openMobileMenu();
            }
        }
    }

    // Open mobile menu
    openMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.add('mobile-open');
        }
        
        if (overlay) {
            overlay.classList.add('active');
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    // Close mobile menu
    closeMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        
        if (overlay) {
            overlay.classList.remove('active');
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Create sidebar overlay for mobile
    createSidebarOverlay() {
        let overlay = document.querySelector('.sidebar-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => {
                this.closeMobileMenu();
            });
            
            const dashboardLayout = document.querySelector('.dashboard-layout');
            if (dashboardLayout) {
                dashboardLayout.appendChild(overlay);
            }
        }
    }

    // Remove sidebar overlay
    removeSidebarOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Handle mobile orientation change
    handleMobileOrientationChange() {
        // Close mobile menu on orientation change
        this.closeMobileMenu();
        
        // Adjust viewport height for mobile browsers
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Register breakpoint listener
    registerBreakpointListener(callback) {
        this.listeners.push(callback);
    }

    // Notify all listeners
    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in breakpoint listener:', error);
            }
        });
    }

    // Get current device info
    getDeviceInfo() {
        return {
            breakpoint: this.currentBreakpoint,
            capabilities: this.deviceCapabilities
        };
    }

    // Check if current breakpoint matches
    isBreakpoint(breakpoint) {
        return this.currentBreakpoint === breakpoint;
    }

    // Check if device has capability
    hasCapability(capability) {
        return this.deviceCapabilities[capability] || false;
    }
}

// ==================== TOUCH CONTROLLER ====================
class TouchController {
    constructor() {
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.swipeThreshold = 50;
        this.tapThreshold = 200;
    }

    // Initialize touch controller
    init() {
        this.setupTouchListeners();
        this.setupGestureRecognition();
        console.log('👆 Touch Controller initialized');
    }

    // Setup touch event listeners
    setupTouchListeners() {
        // Add touch feedback to buttons
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('button, .btn, .touch-feedback');
            if (target) {
                this.addTouchFeedback(target);
            }
        });

        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('button, .btn, .touch-feedback');
            if (target) {
                this.removeTouchFeedback(target);
            }
        });

        // Prevent double-tap zoom on buttons
        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('button, .btn');
            if (target) {
                e.preventDefault();
            }
        });
    }

    // Setup gesture recognition
    setupGestureRecognition() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            this.touchStartTime = Date.now();
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            this.touchStartPos = { x: touchStartX, y: touchStartY };
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            
            this.handleGesture(touchStartX, touchStartY, touchEndX, touchEndY);
        });
    }

    // Add visual touch feedback
    addTouchFeedback(element) {
        element.classList.add('touching');
        
        // Create ripple effect
        if (element.classList.contains('touch-feedback')) {
            this.createRipple(element);
        }
    }

    // Remove touch feedback
    removeTouchFeedback(element) {
        setTimeout(() => {
            element.classList.remove('touching');
        }, 150);
    }

    // Create ripple effect
    createRipple(element) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Handle gesture recognition
    handleGesture(startX, startY, endX, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const deltaTime = Date.now() - this.touchStartTime;
        
        // Check for swipe gestures
        if (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal swipe
                if (deltaX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    this.handleSwipeDown();
                } else {
                    this.handleSwipeUp();
                }
            }
        } else if (deltaTime < this.tapThreshold) {
            // Quick tap
            this.handleTap(startX, startY);
        }
    }

    // Handle swipe gestures
    handleSwipeLeft() {
        // Close mobile menu on swipe left
        if (window.ResponsiveManager && window.ResponsiveManager.isBreakpoint('mobile')) {
            const sidebar = document.querySelector('.sidebar.mobile-open');
            if (sidebar) {
                window.ResponsiveManager.closeMobileMenu();
            }
        }
    }

    handleSwipeRight() {
        // Open mobile menu on swipe right from edge
        if (window.ResponsiveManager && window.ResponsiveManager.isBreakpoint('mobile')) {
            if (this.touchStartPos.x < 20) {
                window.ResponsiveManager.openMobileMenu();
            }
        }
    }

    handleSwipeUp() {
        // Handle pull-to-refresh or other up gestures
        console.log('Swipe up detected');
    }

    handleSwipeDown() {
        // Handle swipe down gestures
        console.log('Swipe down detected');
    }

    handleTap(x, y) {
        // Handle tap gestures
        console.log('Tap detected at:', x, y);
    }
}

// Initialize responsive manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ResponsiveManager = new ResponsiveLayoutManager();
});

// Global function for mobile menu toggle (for onclick handlers)
function toggleMobileMenu() {
    if (window.ResponsiveManager) {
        window.ResponsiveManager.toggleMobileMenu();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResponsiveLayoutManager, TouchController };
}
//==================== ENHANCED TOUCH GESTURES ====================
class EnhancedTouchController extends TouchController {
    constructor() {
        super();
        this.pullToRefreshEnabled = true;
        this.swipeNavigationEnabled = true;
        this.pullToRefreshThreshold = 80;
        this.pullToRefreshElement = null;
        this.isPulling = false;
        this.startY = 0;
        this.currentY = 0;
    }

    // Initialize enhanced touch features
    init() {
        super.init();
        this.setupPullToRefresh();
        this.setupSwipeNavigation();
        this.setupTouchFeedbackEnhancements();
        console.log('👆 Enhanced Touch Controller initialized');
    }

    // Setup pull-to-refresh functionality
    setupPullToRefresh() {
        if (!this.pullToRefreshEnabled) return;

        // Create pull-to-refresh indicator
        this.createPullToRefreshIndicator();

        // Add touch listeners for pull-to-refresh
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                this.startY = e.touches[0].clientY;
                this.isPulling = false;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (window.scrollY === 0 && this.startY > 0) {
                this.currentY = e.touches[0].clientY;
                const pullDistance = this.currentY - this.startY;

                if (pullDistance > 0) {
                    this.handlePullToRefresh(pullDistance);
                    if (pullDistance > 10) {
                        e.preventDefault(); // Prevent default scroll
                    }
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.isPulling) {
                this.completePullToRefresh();
            }
            this.resetPullToRefresh();
        });
    }

    // Create pull-to-refresh indicator
    createPullToRefreshIndicator() {
        this.pullToRefreshElement = document.createElement('div');
        this.pullToRefreshElement.className = 'pull-to-refresh-indicator';
        this.pullToRefreshElement.innerHTML = `
            <div class="pull-to-refresh-content">
                <div class="pull-to-refresh-spinner">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <span class="pull-to-refresh-text">Pull to refresh</span>
            </div>
        `;
        
        // Add CSS for pull-to-refresh
        const style = document.createElement('style');
        style.textContent = `
            .pull-to-refresh-indicator {
                position: fixed;
                top: -80px;
                left: 0;
                right: 0;
                height: 80px;
                background: var(--surface);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s ease;
                z-index: 1000;
                border-bottom: 1px solid var(--border);
            }
            
            .pull-to-refresh-content {
                display: flex;
                align-items: center;
                gap: 12px;
                color: var(--text-secondary);
            }
            
            .pull-to-refresh-spinner {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s ease;
            }
            
            .pull-to-refresh-indicator.pulling .pull-to-refresh-spinner {
                transform: rotate(180deg);
            }
            
            .pull-to-refresh-indicator.refreshing .pull-to-refresh-spinner {
                animation: spin 1s linear infinite;
            }
            
            .pull-to-refresh-text {
                font-size: 0.9rem;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.pullToRefreshElement);
    }

    // Handle pull-to-refresh gesture
    handlePullToRefresh(pullDistance) {
        const progress = Math.min(pullDistance / this.pullToRefreshThreshold, 1);
        const translateY = Math.min(pullDistance * 0.5, this.pullToRefreshThreshold * 0.5);
        
        this.pullToRefreshElement.style.transform = `translateY(${translateY}px)`;
        
        if (pullDistance >= this.pullToRefreshThreshold && !this.isPulling) {
            this.isPulling = true;
            this.pullToRefreshElement.classList.add('pulling');
            this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Release to refresh';
            
            // Haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }
        } else if (pullDistance < this.pullToRefreshThreshold && this.isPulling) {
            this.isPulling = false;
            this.pullToRefreshElement.classList.remove('pulling');
            this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Pull to refresh';
        }
    }

    // Complete pull-to-refresh action
    async completePullToRefresh() {
        this.pullToRefreshElement.classList.add('refreshing');
        this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Refreshing...';
        
        try {
            // Trigger refresh action
            await this.triggerRefresh();
            
            // Show success feedback
            this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Refreshed!';
            setTimeout(() => {
                this.resetPullToRefresh();
            }, 500);
        } catch (error) {
            console.error('Refresh failed:', error);
            this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Refresh failed';
            setTimeout(() => {
                this.resetPullToRefresh();
            }, 1000);
        }
    }

    // Reset pull-to-refresh state
    resetPullToRefresh() {
        this.pullToRefreshElement.style.transform = 'translateY(0)';
        this.pullToRefreshElement.classList.remove('pulling', 'refreshing');
        this.pullToRefreshElement.querySelector('.pull-to-refresh-text').textContent = 'Pull to refresh';
        this.isPulling = false;
        this.startY = 0;
        this.currentY = 0;
    }

    // Trigger refresh action
    async triggerRefresh() {
        // Simulate refresh delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Trigger actual refresh logic
        if (window.App && typeof window.App.refreshCurrentView === 'function') {
            await window.App.refreshCurrentView();
        } else {
            // Fallback: reload current data
            window.location.reload();
        }
    }

    // Setup swipe navigation
    setupSwipeNavigation() {
        if (!this.swipeNavigationEnabled) return;

        let startX = 0;
        let startY = 0;
        let isNavigating = false;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isNavigating = false;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (isNavigating) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            // Check if it's a horizontal swipe
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                isNavigating = true;
                
                if (deltaX > 0) {
                    // Swipe right - go back or open menu
                    this.handleSwipeRight();
                } else {
                    // Swipe left - go forward or close menu
                    this.handleSwipeLeft();
                }
            }
        }, { passive: true });
    }

    // Enhanced swipe right handling
    handleSwipeRight() {
        // Check if we're at the edge of the screen (menu gesture)
        if (this.touchStartPos && this.touchStartPos.x < 20) {
            if (window.ResponsiveManager && window.ResponsiveManager.isBreakpoint('mobile')) {
                window.ResponsiveManager.openMobileMenu();
                return;
            }
        }

        // Otherwise, handle as back navigation
        if (window.history.length > 1) {
            window.history.back();
        }
    }

    // Enhanced swipe left handling
    handleSwipeLeft() {
        // Close mobile menu if open
        if (window.ResponsiveManager && window.ResponsiveManager.isBreakpoint('mobile')) {
            const sidebar = document.querySelector('.sidebar.mobile-open');
            if (sidebar) {
                window.ResponsiveManager.closeMobileMenu();
                return;
            }
        }

        // Handle forward navigation or other actions
        console.log('Swipe left detected');
    }

    // Setup enhanced touch feedback
    setupTouchFeedbackEnhancements() {
        // Add ripple effect to buttons
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('button, .btn, .touch-feedback');
            if (target && !target.classList.contains('no-ripple')) {
                this.createRippleEffect(target, e.touches[0]);
            }
        });

        // Add press feedback to interactive elements
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.menu-list a, .action-btn, .stat-card');
            if (target) {
                target.classList.add('touch-pressed');
            }
        });

        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('.menu-list a, .action-btn, .stat-card');
            if (target) {
                setTimeout(() => {
                    target.classList.remove('touch-pressed');
                }, 150);
            }
        });
    }

    // Create ripple effect
    createRippleEffect(element, touch) {
        const rect = element.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        const x = touch.clientX - rect.left - size / 2;
        const y = touch.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;

        // Add ripple animation CSS if not already added
        if (!document.querySelector('#ripple-styles')) {
            const style = document.createElement('style');
            style.id = 'ripple-styles';
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                
                .touch-pressed {
                    transform: scale(0.98);
                    opacity: 0.8;
                    transition: all 0.1s ease;
                }
            `;
            document.head.appendChild(style);
        }

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
}

// ==================== MOBILE NAVIGATION ENHANCEMENTS ====================
class MobileNavigationEnhancer {
    constructor() {
        this.bottomNavigation = null;
        this.fabButton = null;
        this.init();
    }

    init() {
        this.createBottomNavigation();
        this.createFloatingActionButton();
        this.setupNavigationGestures();
        console.log('📱 Mobile Navigation Enhanced');
    }

    // Create bottom navigation for mobile
    createBottomNavigation() {
        if (window.innerWidth > 768) return; // Only for mobile

        this.bottomNavigation = document.createElement('div');
        this.bottomNavigation.className = 'bottom-navigation';
        this.bottomNavigation.innerHTML = `
            <div class="bottom-nav-item active" data-section="dashboard">
                <i class="fas fa-home"></i>
                <span>Home</span>
            </div>
            <div class="bottom-nav-item" data-section="complaints">
                <i class="fas fa-exclamation-circle"></i>
                <span>Complaints</span>
            </div>
            <div class="bottom-nav-item" data-section="notifications">
                <i class="fas fa-bell"></i>
                <span>Alerts</span>
            </div>
            <div class="bottom-nav-item" data-section="profile">
                <i class="fas fa-user"></i>
                <span>Profile</span>
            </div>
        `;

        // Add CSS for bottom navigation
        const style = document.createElement('style');
        style.textContent = `
            .bottom-navigation {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 60px;
                background: var(--surface);
                border-top: 1px solid var(--border);
                display: flex;
                z-index: 100;
                padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            }
            
            .bottom-nav-item {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 4px;
                color: var(--text-muted);
                font-size: 0.7rem;
                cursor: pointer;
                transition: all 0.2s ease;
                min-height: var(--touch-target-min);
            }
            
            .bottom-nav-item.active {
                color: var(--primary);
            }
            
            .bottom-nav-item i {
                font-size: 1.2rem;
            }
            
            .bottom-nav-item:active {
                transform: scale(0.95);
            }
            
            /* Adjust content area for bottom navigation */
            @media (max-width: 767px) {
                .content-area {
                    padding-bottom: 80px;
                }
            }
        `;
        document.head.appendChild(style);

        // Add event listeners
        this.bottomNavigation.addEventListener('click', (e) => {
            const item = e.target.closest('.bottom-nav-item');
            if (item) {
                this.handleBottomNavClick(item);
            }
        });

        document.body.appendChild(this.bottomNavigation);
    }

    // Handle bottom navigation clicks
    handleBottomNavClick(item) {
        // Remove active class from all items
        this.bottomNavigation.querySelectorAll('.bottom-nav-item').forEach(navItem => {
            navItem.classList.remove('active');
        });

        // Add active class to clicked item
        item.classList.add('active');

        // Navigate to section
        const section = item.dataset.section;
        if (window.App && typeof window.App.showSection === 'function') {
            window.App.showSection(section);
        }

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(25);
        }
    }

    // Create floating action button
    createFloatingActionButton() {
        if (window.innerWidth > 768) return; // Only for mobile

        this.fabButton = document.createElement('div');
        this.fabButton.className = 'fab-button';
        this.fabButton.innerHTML = '<i class="fas fa-plus"></i>';

        // Add CSS for FAB
        const style = document.createElement('style');
        style.textContent = `
            .fab-button {
                position: fixed;
                bottom: 80px;
                right: 20px;
                width: 56px;
                height: 56px;
                background: var(--gradient-primary);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
                transition: all 0.3s ease;
                z-index: 99;
            }
            
            .fab-button:active {
                transform: scale(0.9);
            }
            
            .fab-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
            }
        `;
        document.head.appendChild(style);

        // Add click handler
        this.fabButton.addEventListener('click', () => {
            this.handleFabClick();
        });

        document.body.appendChild(this.fabButton);
    }

    // Handle FAB click
    handleFabClick() {
        // Open quick action menu or new complaint form
        if (window.App && typeof window.App.openQuickActions === 'function') {
            window.App.openQuickActions();
        } else {
            // Fallback: open new complaint
            console.log('FAB clicked - open new complaint');
        }

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    // Setup navigation gestures
    setupNavigationGestures() {
        // Edge swipe for back navigation
        let edgeSwipeStartX = 0;
        let isEdgeSwipe = false;

        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            if (touch.clientX < 20) { // Left edge
                edgeSwipeStartX = touch.clientX;
                isEdgeSwipe = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (isEdgeSwipe) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - edgeSwipeStartX;
                
                if (deltaX > 50) {
                    // Trigger back navigation
                    if (window.history.length > 1) {
                        window.history.back();
                    }
                    isEdgeSwipe = false;
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isEdgeSwipe = false;
        });
    }
}

// Initialize enhanced touch features on mobile devices
document.addEventListener('DOMContentLoaded', () => {
    if ('ontouchstart' in window) {
        window.EnhancedTouchController = new EnhancedTouchController();
        window.MobileNavigationEnhancer = new MobileNavigationEnhancer();
    }
});