import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pagesConfig } from '@/pages.config';

// NavigationTracker — logs page visits for analytics.
// base44.appLogs removed; extend this with your own analytics if needed.
export default function NavigationTracker() {
    const location  = useLocation();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    useEffect(() => {
        if (!isAuthenticated) return;

        const pathname = location.pathname;
        let pageName;

        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];
            const matched = Object.keys(Pages).find(
                k => k.toLowerCase() === pathSegment.toLowerCase()
            );
            pageName = matched || null;
        }

        // Silently track page — replace with your own analytics call if desired
        if (pageName) {
            // e.g. fetch('/analytics', { method: 'POST', body: JSON.stringify({ page: pageName }) })
        }
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}
