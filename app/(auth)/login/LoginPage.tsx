'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from "../../../components/ui/button";

const LoginPage: React.FC = () => {
    const { loginWithGoogle, isAuthenticated, isAuthLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const redirectPath = searchParams.get('redirect') || '/';

    useEffect(() => {
        if (isAuthenticated) {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
            const isLocal =
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                /^192\.168\./.test(hostname) ||
                /^10\./.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

            if (isLocal) {
                router.push(redirectPath);
            } else {
                window.location.href = 'https://project.limperialtech.com';
            }
        }
    }, [isAuthenticated, router, redirectPath]);

    const handleGoogleSignIn = async () => {
        setIsLoggingIn(true);
        setError('');
        try {
            await loginWithGoogle();
            // Redirects to Google — page will leave
        } catch (err: any) {
            setError('Could not connect to Google. Please check your internet connection.');
            setIsLoggingIn(false);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Checking session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-background lg:grid lg:grid-cols-2">

            {/* Left — Sign in */}
            <div className="flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-sm">

                    {/* Mobile logo */}
                    <div className="lg:hidden mb-10 flex justify-center">
                        <img src="https://i.imgur.com/Hur36Vc.png" alt="Limperial Logo" className="h-12 w-auto" />
                    </div>

                    <div className="text-left mb-10">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Sign in</h1>
                        <p className="mt-2 text-sm text-slate-500">to continue to Limperial Dashboard</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-3 bg-destructive/10 p-4 rounded-lg border border-destructive/20 mb-6">
                            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-destructive">Sign in failed</h3>
                                <p className="text-sm text-destructive/80 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Google button */}
                    <Button
                        variant="outline"
                        className="w-full h-12 flex items-center justify-center gap-3 font-medium border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-base shadow-sm"
                        onClick={handleGoogleSignIn}
                        disabled={isLoggingIn}
                    >
                        {isLoggingIn ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {isLoggingIn ? 'Redirecting...' : 'Continue with Google'}
                    </Button>

                    <p className="mt-6 text-xs text-center text-slate-400">
                        Only accounts registered by your administrator can sign in.
                    </p>

                </div>
            </div>

            {/* Right — Branding */}
            <div className="hidden lg:flex flex-col justify-between bg-brand-800 p-8 xl:p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-white/5 rounded-full" />
                <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-white/5 rounded-full" />
                <div className="relative flex items-center gap-3 z-10">
                    <img src="https://i.imgur.com/Hur36Vc.png" alt="Limperial Logo" className="h-12 w-auto brightness-0 invert" />
                </div>
                <div className="relative my-auto z-10">
                    <h2 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
                        Empowering Your<br />Projects. Simplified.
                    </h2>
                    <p className="mt-4 text-brand-200 text-lg max-w-xl">
                        The command center for your tech initiatives, bringing clarity and control to every stage of your work.
                    </p>
                </div>
                <div className="relative z-10">
                    <p className="text-xs text-brand-300">&copy; {new Date().getFullYear()} Limperial Technology Co., Ltd.</p>
                </div>
            </div>

        </div>
    );
};

export default LoginPage;
