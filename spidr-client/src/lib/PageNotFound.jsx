import { useLocation } from 'react-router-dom';
import { entities, auth, integrations } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';


export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });
    
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-black relative overflow-hidden">
            {/* Spider Web Background */}
            <div className="absolute inset-0 opacity-5">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="web" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                            <circle cx="50" cy="50" r="2" fill="#dc2626" />
                            <line x1="50" y1="50" x2="100" y2="50" stroke="#dc2626" strokeWidth="0.5" />
                            <line x1="50" y1="50" x2="0" y2="50" stroke="#dc2626" strokeWidth="0.5" />
                            <line x1="50" y1="50" x2="50" y2="0" stroke="#dc2626" strokeWidth="0.5" />
                            <line x1="50" y1="50" x2="50" y2="100" stroke="#dc2626" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#web)" />
                </svg>
            </div>

            <div className="max-w-md w-full relative z-10">
                <div className="text-center space-y-6 bg-zinc-900/50 backdrop-blur-xl border border-red-900/30 rounded-2xl p-8">
                    {/* 404 Error Code */}
                    <div className="space-y-2">
                        <h1 className="text-8xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent animate-pulse">
                            404
                        </h1>
                        <div className="h-1 w-16 bg-gradient-to-r from-red-600 to-red-400 mx-auto rounded-full"></div>
                    </div>
                    
                    {/* Main Message */}
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-white">
                            Lost in the Web
                        </h2>
                        <p className="text-zinc-400 leading-relaxed">
                            The page <span className="font-medium text-red-500">"{pageName}"</span> doesn't exist in the Spidr network.
                        </p>
                    </div>
                    
                    {/* Admin Note */}
                    {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
                        <div className="mt-8 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                </div>
                                <div className="text-left space-y-1">
                                    <p className="text-sm font-medium text-red-400">Admin Note</p>
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        This page hasn't been implemented yet. Ask the AI to create it in the chat.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Action Button */}
                    <div className="pt-6">
                        <button 
                            onClick={() => window.location.href = '/'} 
                            className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-red-600 border border-red-500 rounded-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-black"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Return to Web
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}