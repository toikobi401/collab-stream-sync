import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/ui/loading';
import { Users, Video, Zap, ArrowRight } from 'lucide-react';
import heroImage from '@/assets/hero-streaming.jpg';
import logoImage from '@/assets/logo-sync.jpg';

export default function Index() {
  const navigate = useNavigate();
  const auth = useAuth();

  // Redirect authenticated users to the room
  useEffect(() => {
    if (!auth.loading && auth.user) {
      navigate('/room', { replace: true });
    }
  }, [auth.loading, auth.user, navigate]);

  if (auth.loading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0">
        <img 
          src={heroImage}
          alt="Streaming background"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 gradient-bg opacity-90" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-4xl space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <img 
                src={logoImage}
                alt="CollabStream Sync"
                className="w-20 h-20 rounded-xl shadow-primary glow-primary"
              />
            </div>
            <div>
              <h1 className="text-6xl font-bold text-gradient-primary mb-4">
                CollabStream Sync
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Watch videos together in perfect sync. Host movies, shows, and streams 
                with friends across the world.
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <Card className="gradient-card border-card-border text-center">
              <CardHeader>
                <div className="w-16 h-16 mx-auto gradient-primary rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle>Multi-User Rooms</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Up to 5 viewers per room with real-time synchronization
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="gradient-card border-card-border text-center">
              <CardHeader>
                <div className="w-16 h-16 mx-auto gradient-accent rounded-xl flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-accent-foreground" />
                </div>
                <CardTitle>Perfect Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Advanced timing algorithms ensure everyone stays in sync
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="gradient-card border-card-border text-center">
              <CardHeader>
                <div className="w-16 h-16 mx-auto gradient-card rounded-xl flex items-center justify-center border border-card-border mb-4">
                  <Zap className="w-8 h-8 text-foreground" />
                </div>
                <CardTitle>Low Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Optimized for minimal delay and smooth playback
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center space-y-6">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg"
              className="text-lg px-8 py-6"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <p className="text-sm text-muted-foreground">
              No account required • Join instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}