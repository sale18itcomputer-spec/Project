'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { Lock, Eye, EyeOff, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { decodeJwt } from "../../utils/formatters";

declare global {
    interface Window {
        google: any;
    }
}

// --- Google Client ID Note ---
// The Google Client ID is provided below to enable Google Sign-In functionality.
// For client-side web applications like this, only a Client ID is used.
// A "Client Secret" is NEVER exposed in frontend code as it would be a major security risk.
// The authentication flow used here (Google Identity Services) is the modern, secure standard for SPAs.
// ---

const LoginPage: React.FC = () => {
    const { login, loginWithGoogle } = useAuth();
    const { loading: isDataLoading } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const googleSignInButtonRef = useRef<HTMLDivElement>(null);

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
    
    const handleGoogleSignIn = async (response: any) => {
        setIsLoggingIn(true);
        setError('');
        const idToken = response.credential;
        const decodedToken: { email?: string } | null = decodeJwt(idToken);

        if (decodedToken && decodedToken.email) {
            const { success, message } = await loginWithGoogle(decodedToken.email);
            if (!success) {
                setError(message);
            }
        } else {
            setError("Could not retrieve email from Google Sign-In. Please try again.");
        }
        setIsLoggingIn(false);
    };
    
    useEffect(() => {
        if (window.google?.accounts?.id && googleSignInButtonRef.current) {
            const googleClientId = "501794043534-tsm5tvj16lf1hmmdhfp2t5koq252pctb.apps.googleusercontent.com";
            if (!googleClientId) {
                console.error("Google Client ID is not configured. Google Sign-In will not be available.");
                return;
            }
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleSignIn
            });

            window.google.accounts.id.renderButton(
                googleSignInButtonRef.current,
                { 
                    theme: "outline", 
                    size: "large", 
                    type: "standard", 
                    shape: "rectangular", 
                    logo_alignment: "left"
                }
            );
        }
    }, [isLoggingIn]);


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

                    <div className="w-full flex justify-center" ref={googleSignInButtonRef} />

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
                        Empowering Your<br/>Projects. Simplified.
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

