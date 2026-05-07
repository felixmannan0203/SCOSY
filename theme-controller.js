// ==================== THEME CONTROLLER ====================
const ThemeController = {
    currentTheme: 'dark',
    
    init() {
        // Detect system preference
        const systemPreference = this.detectSystemPreference();
        
        // Load saved preference or use system preference
        const savedTheme = this.loadPreference();
        const initialTheme = savedTheme || systemPreference;
        
        // Set initial theme
        this.setTheme(initialTheme);
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.loadPreference()) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },
    
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        this.savePreference(newTheme);
    },
    
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            theme = 'dark'; // fallback
        }
        
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme icon
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            if (theme === 'light') {
                themeIcon.className = 'fas fa-moon';
            } else {
                themeIcon.className = 'fas fa-sun';
            }
        }
        
        // Update tooltip
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
        }
    },
    
    getCurrentTheme() {
        return this.currentTheme;
    },
    
    detectSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    },
    
    savePreference(theme) {
        try {
            localStorage.setItem('scosy_theme_preference', theme);
        } catch (e) {
            console.warn('Failed to save theme preference:', e);
        }
    },
    
    loadPreference() {
        try {
            const saved = localStorage.getItem('scosy_theme_preference');
            if (saved === 'light' || saved === 'dark') {
                return saved;
            }
        } catch (e) {
            console.warn('Failed to load theme preference:', e);
        }
        return null;
    }
};

// Global function for the toggle button
function toggleTheme() {
    ThemeController.toggleTheme();
}

// Initialize theme controller when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    ThemeController.init();
});