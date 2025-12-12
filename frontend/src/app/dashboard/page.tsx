'use client';

'use client';

import { useState } from 'react';
import { useTeams, useStatus } from '@/hooks/useBackendData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function Dashboard() {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: status } = useStatus();
  const { isConnected } = useAccount();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');

  const calculateOdds = (teamId: number, amount: string) => {
    if (!teams || !status) return 0;
    const team = teams.find(t => t.id === teamId);
    if (!team) return 0;
    const userAmount = parseFloat(amount) || 0;
    const totalPool = parseFloat(status.total_prize_pool_wei) / 10**18;
    const teamPool = parseFloat(team.total_bet_wei) / 10**18;
    const newTotal = totalPool + userAmount;
    const newTeam = teamPool + userAmount;
    return (newTotal * 0.9) / newTeam;
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4">请先连接钱包</h1>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="p-4 border-b border-slate-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">CS2 Major Betting</h1>
          <ConnectButton />
        </div>
      </header>

      <main className="p-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">选择战队下注</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <Skeleton className="h-6 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-16 mb-2" />
                    <Skeleton className="h-4 w-12" />
                  </CardContent>
                </Card>
              ))
            ) : (
              teams?.map((team) => (
                <Card key={team.id} className="bg-slate-800 border-slate-700 hover:border-yellow-400 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-yellow-400">{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-400">总下注: {(parseFloat(team.total_bet_wei) / 10**18).toFixed(4)} ETH</p>
                    <p className="text-sm text-slate-400">支持者: {team.supporters}</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setSelectedTeam(team.id)}>
                          下注
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-800 border-slate-700">
                        <DialogHeader>
                          <DialogTitle className="text-yellow-400">下注 {team.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm mb-2">下注金额 (ETH)</label>
                            <Input
                              type="number"
                              value={betAmount}
                              onChange={(e) => setBetAmount(e.target.value)}
                              placeholder="0.01"
                              className="bg-slate-700 border-slate-600"
                            />
                          </div>
                          {betAmount && (
                            <div className="p-4 bg-slate-700 rounded">
                              <p className="text-sm">预计回报: {calculateOdds(team.id, betAmount).toFixed(4)} ETH</p>
                            </div>
                          )}
                          <Button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
                            确认下注
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}