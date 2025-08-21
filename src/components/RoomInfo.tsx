import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { MetricCard } from '@/components/ui/metric-card';
import { useRoom, useMembers, useConnectionState, useVideoState } from '@/store';
import { Users, Wifi, Clock, Activity } from 'lucide-react';
import ms from 'ms';

export function RoomInfo() {
  const room = useRoom();
  const members = useMembers();
  const connectionState = useConnectionState();
  const videoState = useVideoState();

  if (!room) return null;

  const getDriftStatus = (drift: number) => {
    if (drift > 400) return 'error';
    if (drift > 100) return 'warning';
    return 'success';
  };

  const getRTTStatus = (rtt: number) => {
    if (rtt > 200) return 'error';
    if (rtt > 100) return 'warning';
    return 'success';
  };

  const currentHost = members.find(member => member.id === videoState.hostId);

  return (
    <div className="space-y-6">
      {/* Room Status */}
      <Card className="gradient-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Room: {room.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Capacity</span>
            <span className="font-mono">{members.length}/{room.capacity}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Connection</span>
            <StatusBadge status={connectionState.connected ? 'online' : 'offline'}>
              {connectionState.connected ? 'Connected' : 'Disconnected'}
            </StatusBadge>
          </div>

          {currentHost && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Host</span>
              <StatusBadge status="host">
                {currentHost.nickname}
              </StatusBadge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members List */}
      <Card className="gradient-card border-card-border">
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <span className="text-sm">{member.nickname}</span>
                <div className="flex gap-2">
                  <StatusBadge status="online" />
                  {member.id === videoState.hostId && (
                    <StatusBadge status="host">HOST</StatusBadge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connection Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="Round Trip Time"
          value={connectionState.rtt}
          suffix="ms"
          variant={getRTTStatus(connectionState.rtt)}
          icon={<Wifi className="w-4 h-4" />}
          description="Network latency"
        />
        
        <MetricCard
          title="Sync Drift"
          value={connectionState.drift.toFixed(0)}
          suffix="ms"
          variant={getDriftStatus(connectionState.drift)}
          icon={<Activity className="w-4 h-4" />}
          description="Video sync accuracy"
        />
      </div>

      {/* Video State */}
      {videoState.videoUrl && (
        <MetricCard
          title="Last Sync"
          value={ms(Date.now() - connectionState.lastSync, { compact: true })}
          suffix="ago"
          icon={<Clock className="w-4 h-4" />}
          description="Time since last synchronization"
        />
      )}
    </div>
  );
}