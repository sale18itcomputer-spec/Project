'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from "../../../contexts/AuthContext";
import { useData } from "../../../contexts/DataContext";
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";


// --- Google Client ID Note ---
// The Google Client ID is provided below to enable Google Sign-In functionality.
// For client-side web applications like this, only a Client ID is used.
// A "Client Secret" is NEVER exposed in frontend code as it would be a major security risk.
// The authentication flow used here (Google Identity Services) is the modern, secure standard for SPAs.
// ---

const LoginPage: React.FC = () => {
    const { login, loginWithGoogle, isAuthenticated } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { loading: isDataLoading } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Get the redirect path from URL or default to root
    const redirectPath = searchParams.get('redirect') || '/';

    useEffect(() => {
        if (isAuthenticated) {
            router.push(redirectPath);
        }
    }, [isAuthenticated, router, redirectPath]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email || !password) {
            setError('Both Email and Password are required.');
            return;
        }

        setIsLoggingIn(true);
        const { success, message } = await login(email, password);
        if (!success) {
            setError(message);
        }
        setIsLoggingIn(false);
    };

    const handleGoogleSignIn = async () => {
        setIsLoggingIn(true);
        setError('');
        await loginWithGoogle();
        // The page will redirect to Google for auth.
    };



    const isLoading = isDataLoading || isLoggingIn;

    return (
        <div className="w-full min-h-screen bg-background lg:grid lg:grid-cols-2">
            <div className="flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    <div className="lg:hidden mb-10 flex justify-center">
                        <img
                            src="https://i.imgur.com/Hur36Vc.png"
                            alt="Limperial Company Logo"
                            className="h-12 w-auto"
                        />
                    </div>

                    <div className="text-left">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sign in</h1>
                        <p className="mt-2 text-sm text-slate-600">to continue to Limperial Dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11"
                                    placeholder="your@email.com"
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password">Password</Label>
                                <a href="#" className="text-sm font-medium text-primary hover:underline">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative">
                                <Lock className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10 h-11"
                                    placeholder="Your Password"
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-3 bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-destructive">Login Failed</h3>
                                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-11 text-base"
                            >
                                {isLoading && (
                                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                )}
                                {isLoading ? 'Signing In...' : 'Sign In'}
                            </Button>
                        </div>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-background px-3 text-muted-foreground">Or sign in with</span>
                        </div>
                    </div>

                    <div className="w-full flex justify-center">
                        <Button
                            variant="outline"
                            className="w-full h-11 flex items-center justify-center gap-3 font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </Button>
                    </div>

                </div>
            </div>
            <div className="hidden lg:flex flex-col justify-between bg-brand-800 p-8 xl:p-12 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-white/5 rounded-full" />
                <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-[500px] h-[500px] bg-white/5 rounded-full" />

                <div className="relative flex items-center gap-3 z-10">
                    <img
                        src="https://i.imgur.com/Hur36Vc.png"
                        alt="Limperial Company Logo"
                        className="h-12 w-auto brightness-0 invert"
                    />
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

