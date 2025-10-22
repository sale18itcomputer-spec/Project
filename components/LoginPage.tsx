import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Lock, Eye, EyeOff, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import GoogleIcon from './icons/GoogleIcon';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const { loading: isDataLoading } = useData();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

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

    const isLoading = isDataLoading || isLoggingIn;

    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/40">
            <div className="w-full max-w-sm">
                <div className="flex justify-center items-center mb-8">
                    <img 
                        src="https://i.imgur.com/Hur36Vc.png" 
                        alt="Limperial Company Logo" 
                        className="h-14 w-auto"
                    />
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Sign In</CardTitle>
                        <CardDescription>Welcome back, you've been missed!</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-9"
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
                                     <Lock className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-9 pr-10"
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
                                    className="w-full"
                                >
                                    {isLoading && (
                                        <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                    )}
                                    {isLoading ? 'Signing In...' : 'Sign In'}
                                </Button>
                            </div>
                            
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">OR</span>
                                </div>
                            </div>

                            <div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    <GoogleIcon className="mr-2 h-4 w-4"/>
                                    Sign in with Google
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LoginPage;