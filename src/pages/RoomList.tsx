import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingScreen } from '@/components/ui/loading';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabaseApi } from '@/lib/supabase-api';
import { useStore } from '@/store';
import { Room } from '@/types';
import { Plus, Users, LogOut, Crown, Play } from 'lucide-react';

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const auth = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setRoom, setUser } = useStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [auth.loading, auth.user, navigate]);

  // Load rooms
  useEffect(() => {
    if (!auth.user) return;

    const loadRooms = async () => {
      try {
        setLoading(true);
        const roomsData = await supabaseApi.getRooms();
        
        // Get member counts for each room
        const roomsWithMembers = await Promise.all(
          roomsData.map(async (room) => {
            try {
              const members = await supabaseApi.getRoomMembers(room.id);
              return {
                ...room,
                currentMembers: members.length,
                members: members.map(m => ({
                  id: m.user_id,
                  nickname: m.profiles?.nickname || 'Unknown',
                  joinedAt: new Date(m.joined_at)
                }))
              };
            } catch {
              return { ...room, currentMembers: 0, members: [] };
            }
          })
        );
        
        setRooms(roomsWithMembers);
      } catch (error: any) {
        console.error('Failed to load rooms:', error);
        toast({
          title: "Failed to load rooms",
          description: error.message || "Please try again",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
  }, [auth.user, toast]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const room = await supabaseApi.createRoom(newRoomName.trim());
      
      toast({
        title: "Room created!",
        description: `Created "${room.name}" successfully`,
      });
      
      setDialogOpen(false);
      setNewRoomName('');
      
      // Refresh rooms list
      const roomsData = await supabaseApi.getRooms();
      const roomsWithMembers = await Promise.all(
        roomsData.map(async (r) => {
          const members = await supabaseApi.getRoomMembers(r.id);
          return {
            ...r,
            currentMembers: members.length,
            members: members.map(m => ({
              id: m.user_id,
              nickname: m.profiles?.nickname || 'Unknown',
              joinedAt: new Date(m.joined_at)
            }))
          };
        })
      );
      setRooms(roomsWithMembers);
      
    } catch (error: any) {
      console.error('Create room error:', error);
      setError(error.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (room: Room) => {
    if (room.currentMembers >= room.capacity) {
      toast({
        title: "Room is full",
        description: `This room has reached its maximum capacity of ${room.capacity} members`,
        variant: "destructive"
      });
      return;
    }

    setJoining(room.id);

    try {
      await supabaseApi.joinRoom(room.id);
      
      // Set store state and navigate
      setRoom(room);
      setUser({
        id: auth.user!.id,
        nickname: auth.profile?.nickname || 'Unknown'
      });
      
      toast({
        title: "Joined room",
        description: `Welcome to ${room.name}`,
      });
      
      navigate(`/room/${room.id}`, { replace: true });
    } catch (error: any) {
      console.error('Join room error:', error);
      toast({
        title: "Failed to join room",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setJoining(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseApi.signOut();
      navigate('/auth', { replace: true });
    } catch (error: any) {
      console.error('Sign out error:', error);
    }
  };

  if (!auth.user || loading) {
    return <LoadingScreen message="Loading rooms..." />;
  }

  const canCreateRoom = rooms.length < 3;

  return (
    <div className="min-h-screen p-4 bg-gradient-subtle">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary">
                CollabStream Rooms
              </h1>
              <p className="text-muted-foreground">
                Welcome back, {auth.profile?.nickname || 'User'}!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {rooms.length}/3 rooms
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Create Room Button */}
        <div className="flex justify-center">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                disabled={!canCreateRoom}
                size="lg"
                className="shadow-elegant"
              >
                <Plus className="w-5 h-5 mr-2" />
                {canCreateRoom ? 'Create New Room' : 'Maximum Rooms Reached (3/3)'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Room</DialogTitle>
                <DialogDescription>
                  Give your room a name and start watching together!
                </DialogDescription>
              </DialogHeader>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <Input
                  placeholder="Enter room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  disabled={creating}
                  maxLength={50}
                  required
                />
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={creating || !newRoomName.trim()}
                  >
                    {creating ? "Creating..." : "Create Room"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rooms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card 
              key={room.id} 
              className="border-primary/20 shadow-elegant hover:shadow-glow transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-1">
                    {room.name}
                  </CardTitle>
                  {room.created_by === auth.user?.id && (
                    <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {room.currentMembers}/{room.capacity} members
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Member badges */}
                  {room.members.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {room.members.slice(0, 3).map((member) => (
                        <Badge 
                          key={member.id} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {member.nickname}
                        </Badge>
                      ))}
                      {room.members.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{room.members.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Join button */}
                  <Button 
                    className="w-full"
                    onClick={() => handleJoinRoom(room)}
                    disabled={joining === room.id || room.currentMembers >= room.capacity}
                  >
                    {joining === room.id ? (
                      "Joining..."
                    ) : room.currentMembers >= room.capacity ? (
                      "Room Full"
                    ) : (
                      "Join Room"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {rooms.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-muted/50 rounded-lg inline-block mb-4">
              <Users className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No rooms available</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to create a room and start watching together!
            </p>
            {canCreateRoom && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Room
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}