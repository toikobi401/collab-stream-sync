import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui/loading';
import { Play, Users } from 'lucide-react';

export default function NicknameAuth() {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  // Redirect if already authenticated
  if (auth.loading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  if (auth.user) {
    navigate('/rooms', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await supabaseApi.signUpWithNickname(nickname.trim());
      
      toast({
        title: "Welcome!",
        description: `Logged in as ${nickname}`,
      });
      
      navigate('/rooms', { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      
      toast({
        title: "Login failed",
        description: err.message || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-gradient-primary">
              CollabStream
            </h1>
          </div>
          <p className="text-muted-foreground">
            Join rooms and watch videos together in perfect sync
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-primary/20 shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Join the Stream
            </CardTitle>
            <CardDescription>
              Enter your nickname to get started
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Enter your nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  disabled={loading}
                  className="text-center text-lg"
                  maxLength={20}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={loading || !nickname.trim()}
                size="lg"
              >
                {loading ? "Joining..." : "Join Stream"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>✨ No signup required - just pick a nickname</p>
          <p>🎬 Watch videos together in real-time</p>
          <p>👥 Join up to 5 people per room</p>
        </div>
      </div>
    </div>
  );
}