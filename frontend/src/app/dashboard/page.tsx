'use client';

import { useState } from 'react';
import { useTeams, useStatus } from '@/hooks/useBackendData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

// 合约ABI - bet函数
const BET_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_teamId", type: "uint256" }],
    name: "bet",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
] as const;

// 合约地址
const CONTRACT_ADDRESS = '0x34f339aabb5887cba8c536905D1A0554bd7DA94A' as `0x${string}`;

// 单个队伍的下注卡片组件
function TeamBetCard({ team, totalPool }: { team: { id: number; name: string; total_bet_wei: string; supporters: number }; totalPool: number }) {
  const [betAmount, setBetAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const calculateOdds = () => {
    const userAmount = parseFloat(betAmount) || 0;
    const teamPool = parseFloat(team.total_bet_wei) / 10**18;
    const newTotal = totalPool + userAmount;
    const newTeam = teamPool + userAmount;
    if (newTeam === 0) return 0;
    return (newTotal * 0.9) / newTeam;
  };

  const handleBet = () => {
    if (!betAmount || isNaN(parseFloat(betAmount)) || parseFloat(betAmount) <= 0) {
      alert('请输入有效的下注金额（大于0的数字）');
      return;
    }

    const amountInWei = parseEther(betAmount);
    
    console.log('正在下注:', {
      teamId: team.id,
      teamName: team.name,
      amount: betAmount,
      amountInWei: amountInWei.toString(),
      contractAddress: CONTRACT_ADDRESS
    });

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: BET_ABI,
      functionName: 'bet',
      args: [BigInt(team.id)],
      value: amountInWei,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // 关闭时重置状态
      setBetAmount('');
      reset();
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-yellow-400 transition-colors">
      <CardHeader>
        <CardTitle className="text-yellow-400">{team.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">总下注: {(parseFloat(team.total_bet_wei) / 10**18).toFixed(6)} ETH</p>
        <p className="text-sm text-slate-400">支持者: {team.supporters}</p>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              下注
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-yellow-400">下注 {team.name}</DialogTitle>
              <DialogDescription className="text-slate-400">
                请输入下注金额并确认交易。队伍ID: {team.id}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 text-white">下注金额 (ETH)</label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0.01"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              {betAmount && parseFloat(betAmount) > 0 && (
                <div className="p-4 bg-slate-700 rounded">
                  <p className="text-sm text-white">预计回报倍数: {calculateOdds().toFixed(2)}x</p>
                  <p className="text-sm text-slate-400">如果获胜，预计可得: {(parseFloat(betAmount) * calculateOdds()).toFixed(6)} ETH</p>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-900 rounded">
                  <p className="text-sm text-red-300">错误: {error.message}</p>
                </div>
              )}
              {isSuccess && (
                <div className="p-4 bg-green-900 rounded">
                  <p className="text-sm text-green-300">✅ 交易成功！</p>
                  <p className="text-xs text-green-400 break-all">交易哈希: {hash}</p>
                </div>
              )}
              <Button 
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold" 
                onClick={handleBet}
                disabled={isPending || isConfirming || !betAmount || parseFloat(betAmount) <= 0}
              >
                {isPending ? '请在钱包中确认...' : isConfirming ? '交易处理中...' : `确认下注 ${betAmount || '0'} ETH`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: status } = useStatus();
  const { isConnected } = useAccount();

  // 计算总奖池
  const totalPool = status ? parseFloat(status.total_prize_pool_wei) / 10**18 : 0;

  // 检查游戏状态
  if (status && status.status !== 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl mb-4">投注已关闭</h1>
          <p className="text-slate-400">当前状态：{status.status_text}</p>
          {status.winning_team_id !== null && status.winning_team_id !== 0 && (
            <p className="text-yellow-400 mt-2">获胜队伍ID: {status.winning_team_id}</p>
          )}
        </div>
      </div>
    );
  }

  // 检查钱包连接
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl mb-4 text-white">请先连接钱包</h1>
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
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">选择战队下注</h2>
            <p className="text-slate-400">当前总奖池: {totalPool.toFixed(6)} ETH</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
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
                <TeamBetCard key={team.id} team={team} totalPool={totalPool} />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
