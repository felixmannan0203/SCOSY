const App = (function() {
    'use strict';

    // ==================== STATE ====================
    let currentUser = null;
    let sessionTimer = null;
    let sessionSeconds = 1800; // 30 minutes
    let lockoutTimer = null