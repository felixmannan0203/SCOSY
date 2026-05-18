// ==================== PERFORMANCE OPTIMIZATION MODULE ====================

class PerformanceOptimizer {
    constructor() {
        this.lazyLoadObserver = null;
        this.imageOptimizer = new ImageOptimizer();
        this.bundleOptimizer = new BundleOptimizer();
        this.networkOptimizer = new NetworkOptimizer();
        
        this.init();
    }

    // Initialize performance optimizations
    init() {
        this.setupLazyLoading();
        this.optimizeImages();
        this.setupProgressiveLoading();
        this.monitorPerformance();
        
        console.log('⚡ Performance Optimizer initialized');
    }

    // Setup lazy loading for components
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.lazyLoadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadComponent(entry.target);
                        this.lazyLoadObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px'
            });

            // Observe lazy-loadable elements
            this.observeLazyElements();
        } else {
            // Fallback for older browsers
            this.loadAllComponents();
        }
    }

    // Observe elements that should be lazy loaded
    observeLazyElements() {
        const lazyElements = document.querySelectorAll('[data-lazy]');
        lazyElements.forEach(element => {
            this.lazyLoadObserver.observe(element);
        });
    }

    // Load a specific component
    loadComponent(element) {
        const componentType = element.dataset.lazy;
        
        switch (componentType) {
            case 'complaints-list':
                this.loadComplaintsList(element);
                break;
            case 'admin-stats':
                this.loadAdminStats(element);
                break;
            case 'activity-log':
                this.loadActivityLog(element);
                break;
            case 'chart':
                this.loadChart(element);
                break;
            default:
                console.warn('Unknown lazy component:', componentType);
        }
    }

    // Load complaints list component
    async loadComplaintsList(element) {
        try {
            element.innerHTML = this.getSkeletonLoader('list');
            
            // Simulate loading delay for demo
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const complaints = await this.fetchComplaints();
            this.renderComplaintsList(element, complaints);
        } catch (error) {
            console.error('Failed to load complaints list:', error);
            element.innerHTML = '<p class="error">Failed to load complaints</p>';
        }
    }

    // Load admin stats component
    async loadAdminStats(element) {
        try {
            element.innerHTML = this.getSkeletonLoader('stats');
            
            const stats = await this.fetchAdminStats();
            this.renderAdminStats(element, stats);
        } catch (error) {
            console.error('Failed to load admin stats:', error);
            element.innerHTML = '<p class="error">Failed to load statistics</p>';
        }
    }

    // Load activity log component
    async loadActivityLog(element) {
        try {
            element.innerHTML = this.getSkeletonLoader('activity');
            
            const activities = await this.fetchActivityLog();
            this.renderActivityLog(element, activities);
        } catch (error) {
            console.error('Failed to load activity log:', error);
            element.innerHTML = '<p class="error">Failed to load activity</p>';
        }
    }

    // Load chart component
    async loadChart(element) {
        try {
            element.innerHTML = this.getSkeletonLoader('chart');
            
            // Dynamically import chart library only when needed
            const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js');
            
            const chartData = await this.fetchChartData();
            this.renderChart(element, Chart, chartData);
        } catch (error) {
            console.error('Failed to load chart:', error);
            element.innerHTML = '<p class="error">Failed to load chart</p>';
        }
    }

    // Get skeleton loader HTML
    getSkeletonLoader(type) {
        switch (type) {
            case 'list':
                return `
                    <div class="skeleton-list">
                        ${Array(5).fill().map(() => `
                            <div class="skeleton-item">
                                <div class="skeleton-avatar loading-skeleton"></div>
                                <div class="skeleton-content">
                                    <div class="skeleton-title loading-skeleton"></div>
                                    <div class="skeleton-text loading-skeleton"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'stats':
                return `
                    <div class="skeleton-stats">
                        ${Array(4).fill().map(() => `
                            <div class="skeleton-stat-card">
                                <div class="skeleton-stat-icon loading-skeleton"></div>
                                <div class="skeleton-stat-number loading-skeleton"></div>
                                <div class="skeleton-stat-label loading-skeleton"></div>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'activity':
                return `
                    <div class="skeleton-activity">
                        ${Array(3).fill().map(() => `
                            <div class="skeleton-activity-item">
                                <div class="skeleton-activity-icon loading-skeleton"></div>
                                <div class="skeleton-activity-text loading-skeleton"></div>
                                <div class="skeleton-activity-time loading-skeleton"></div>
                            </div>
                        `).join('')}
                    </div>
                `;
            case 'chart':
                return `
                    <div class="skeleton-chart">
                        <div class="skeleton-chart-area loading-skeleton"></div>
                    </div>
                `;
            default:
                return '<div class="loading-skeleton" style="height: 100px;"></div>';
        }
    }

    // Optimize images
    optimizeImages() {
        this.imageOptimizer.init();
    }

    // Setup progressive loading
    setupProgressiveLoading() {
        // Load critical CSS first
        this.loadCriticalCSS();
        
        // Defer non-critical JavaScript
        this.deferNonCriticalJS();
        
        // Preload important resources
        this.preloadResources();
    }

    // Load critical CSS
    loadCriticalCSS() {
        const criticalCSS = `
            /* Critical above-the-fold styles */
            body { font-family: 'Inter', sans-serif; margin: 0; }
            .auth-page { display: flex; min-height: 100vh; }
            .loading-skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); }
        `;
        
        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.appendChild(style);
    }

    // Defer non-critical JavaScript
    deferNonCriticalJS() {
        const scripts = [
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
        ];
        
        scripts.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = src;
            link.media = 'print';
            link.onload = function() { this.media = 'all'; };
            document.head.appendChild(link);
        });
    }

    // Preload important resources
    preloadResources() {
        const resources = [
            { href: '/api/auth/login', as: 'fetch' },
            { href: '/icons/icon-192x192.png', as: 'image' }
        ];
        
        resources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            if (resource.as === 'fetch') {
                link.crossOrigin = 'anonymous';
            }
            document.head.appendChild(link);
        });
    }

    // Monitor performance
    monitorPerformance() {
        if ('PerformanceObserver' in window) {
            // Monitor Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log('📊 LCP:', lastEntry.startTime);
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            // Monitor First Input Delay
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    console.log('📊 FID:', entry.processingStart - entry.startTime);
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });

            // Monitor Cumulative Layout Shift
            const clsObserver = new PerformanceObserver((list) => {
                let clsValue = 0;
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                console.log('📊 CLS:', clsValue);
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
        }
    }

    // Load all components (fallback)
    loadAllComponents() {
        const lazyElements = document.querySelectorAll('[data-lazy]');
        lazyElements.forEach(element => {
            this.loadComponent(element);
        });
    }

    // Fetch methods (these would connect to actual APIs)
    async fetchComplaints() {
        // Simulate API call
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    { id: 1, subject: 'Sample Complaint 1', status: 'pending' },
                    { id: 2, subject: 'Sample Complaint 2', status: 'resolved' }
                ]);
            }, 300);
        });
    }

    async fetchAdminStats() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    totalComplaints: 45,
                    pendingComplaints: 12,
                    totalUsers: 234,
                    resolvedToday: 8
                });
            }, 200);
        });
    }

    async fetchActivityLog() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    { action: 'Login', time: '2 minutes ago' },
                    { action: 'New Complaint', time: '5 minutes ago' },
                    { action: 'Response Sent', time: '10 minutes ago' }
                ]);
            }, 250);
        });
    }

    async fetchChartData() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                    datasets: [{
                        label: 'Complaints',
                        data: [12, 19, 3, 5, 2],
                        backgroundColor: 'rgba(79, 70, 229, 0.2)',
                        borderColor: 'rgba(79, 70, 229, 1)'
                    }]
                });
            }, 400);
        });
    }

    // Render methods
    renderComplaintsList(element, complaints) {
        element.innerHTML = `
            <div class="complaints-list">
                ${complaints.map(complaint => `
                    <div class="complaint-item">
                        <h4>${complaint.subject}</h4>
                        <span class="status status-${complaint.status}">${complaint.status}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAdminStats(element, stats) {
        element.innerHTML = `
            <div class="admin-stats">
                <div class="stat-item">
                    <span class="stat-number">${stats.totalComplaints}</span>
                    <span class="stat-label">Total Complaints</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.pendingComplaints}</span>
                    <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.totalUsers}</span>
                    <span class="stat-label">Users</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.resolvedToday}</span>
                    <span class="stat-label">Resolved Today</span>
                </div>
            </div>
        `;
    }

    renderActivityLog(element, activities) {
        element.innerHTML = `
            <div class="activity-log">
                ${activities.map(activity => `
                    <div class="activity-item">
                        <span class="activity-action">${activity.action}</span>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderChart(element, Chart, chartData) {
        const canvas = document.createElement('canvas');
        element.innerHTML = '';
        element.appendChild(canvas);
        
        new Chart(canvas, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// ==================== IMAGE OPTIMIZER ====================
class ImageOptimizer {
    constructor() {
        this.webpSupported = null;
        this.avifSupported = null;
    }

    init() {
        this.checkFormatSupport();
        this.setupResponsiveImages();
        this.setupLazyImageLoading();
    }

    // Check browser support for modern image formats
    async checkFormatSupport() {
        this.webpSupported = await this.supportsFormat('webp');
        this.avifSupported = await this.supportsFormat('avif');
        
        console.log('🖼️ Image format support:', {
            webp: this.webpSupported,
            avif: this.avifSupported
        });
    }

    // Check if browser supports image format
    supportsFormat(format) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            
            const testImages = {
                webp: 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA',
                avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A='
            };
            
            img.src = testImages[format];
        });
    }

    // Setup responsive images
    setupResponsiveImages() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            this.makeImageResponsive(img);
        });
    }

    // Make image responsive with optimal format
    makeImageResponsive(img) {
        const baseSrc = img.dataset.src;
        const sizes = img.dataset.sizes || '100vw';
        
        // Create picture element for format selection
        const picture = document.createElement('picture');
        
        // Add AVIF source if supported
        if (this.avifSupported) {
            const avifSource = document.createElement('source');
            avifSource.srcset = this.generateSrcSet(baseSrc, 'avif');
            avifSource.sizes = sizes;
            avifSource.type = 'image/avif';
            picture.appendChild(avifSource);
        }
        
        // Add WebP source if supported
        if (this.webpSupported) {
            const webpSource = document.createElement('source');
            webpSource.srcset = this.generateSrcSet(baseSrc, 'webp');
            webpSource.sizes = sizes;
            webpSource.type = 'image/webp';
            picture.appendChild(webpSource);
        }
        
        // Add fallback image
        img.srcset = this.generateSrcSet(baseSrc, 'jpg');
        img.sizes = sizes;
        picture.appendChild(img);
        
        // Replace original img with picture
        img.parentNode.replaceChild(picture, img);
    }

    // Generate srcset for different sizes
    generateSrcSet(baseSrc, format) {
        const sizes = [320, 640, 960, 1280, 1920];
        return sizes.map(size => {
            const optimizedSrc = this.getOptimizedImageUrl(baseSrc, size, format);
            return `${optimizedSrc} ${size}w`;
        }).join(', ');
    }

    // Get optimized image URL (would integrate with image CDN)
    getOptimizedImageUrl(baseSrc, width, format) {
        // This would integrate with an image optimization service
        // For now, return original URL with query parameters
        const url = new URL(baseSrc, window.location.origin);
        url.searchParams.set('w', width);
        url.searchParams.set('f', format);
        url.searchParams.set('q', '80'); // Quality
        return url.toString();
    }

    // Setup lazy loading for images
    setupLazyImageLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        imageObserver.unobserve(entry.target);
                    }
                });
            });

            const lazyImages = document.querySelectorAll('img[data-src]');
            lazyImages.forEach(img => imageObserver.observe(img));
        }
    }

    // Load image
    loadImage(img) {
        img.src = img.dataset.src;
        img.classList.add('loaded');
    }
}

// ==================== BUNDLE OPTIMIZER ====================
class BundleOptimizer {
    constructor() {
        this.loadedModules = new Set();
    }

    // Dynamically import modules only when needed
    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return;
        }

        try {
            switch (moduleName) {
                case 'chart':
                    await import('https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js');
                    break;
                case 'datepicker':
                    await import('https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js');
                    break;
                case 'editor':
                    await import('https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js');
                    break;
                default:
                    console.warn('Unknown module:', moduleName);
                    return;
            }
            
            this.loadedModules.add(moduleName);
            console.log('📦 Loaded module:', moduleName);
        } catch (error) {
            console.error('Failed to load module:', moduleName, error);
        }
    }

    // Preload critical modules
    preloadCriticalModules() {
        const criticalModules = ['chart'];
        criticalModules.forEach(module => {
            this.loadModule(module);
        });
    }
}

// ==================== NETWORK OPTIMIZER ====================
class NetworkOptimizer {
    constructor() {
        this.requestCache = new Map();
        this.connectionType = this.getConnectionType();
    }

    // Get connection type
    getConnectionType() {
        if ('connection' in navigator) {
            return navigator.connection.effectiveType;
        }
        return 'unknown';
    }

    // Optimize requests based on connection
    async optimizeRequest(url, options = {}) {
        // Use cache for repeated requests
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        if (this.requestCache.has(cacheKey)) {
            return this.requestCache.get(cacheKey);
        }

        // Adjust timeout based on connection
        const timeout = this.getTimeoutForConnection();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Cache successful responses
            if (response.ok) {
                this.requestCache.set(cacheKey, response.clone());
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Get timeout based on connection type
    getTimeoutForConnection() {
        switch (this.connectionType) {
            case 'slow-2g':
                return 10000; // 10 seconds
            case '2g':
                return 8000;  // 8 seconds
            case '3g':
                return 5000;  // 5 seconds
            case '4g':
                return 3000;  // 3 seconds
            default:
                return 5000;  // 5 seconds default
        }
    }

    // Batch requests to reduce network overhead
    batchRequests(requests) {
        return Promise.allSettled(
            requests.map(request => this.optimizeRequest(request.url, request.options))
        );
    }
}

// Initialize performance optimizer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.PerformanceOptimizer = new PerformanceOptimizer();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceOptimizer, ImageOptimizer, BundleOptimizer, NetworkOptimizer };
}