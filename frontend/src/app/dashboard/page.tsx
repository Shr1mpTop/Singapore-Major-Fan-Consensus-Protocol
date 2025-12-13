'use client';

import { useState, useEffect } from 'react';
import { useTeams, useStatus } from '@/hooks/useBackendData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useQueryClient } from '@tanstack/react-query';

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
const CONTRACT_ADDRESS: `0x${string}` = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xb5c4bea741cea63b2151d719b2cca12e80e6c7e8') as `0x${string}`;

// 单个队伍的下注卡片组件
function TeamBetCard({ team, totalPool }: { team: { id: number; name: string; total_bet_wei: string; supporters: number }; totalPool: number }) {
  const [betAmount, setBetAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { data: status } = useStatus();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // 添加调试信息
  console.log('TeamBetCard render:', {
    teamId: team.id,
    address,
    isPending,
    isConfirming,
    isSuccess,
    error: error?.message,
    hash
  });

  useEffect(() => {
    console.log('useEffect triggered:', { isSuccess, address, hash });
    if (isSuccess && address) {
      // 记录用户下注到后端数据库（事件监听器会自动同步链上数据）
      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001/api';
      fetch(`${API_BASE_URL}/record_bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          teamId: team.id,
          amount: (parseEther(betAmount)).toString(),  // Wei string
        }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => console.log('Bet recorded:', data))
      .catch((error) => {
        console.error('Record bet error:', error);
        alert('记录下注失败，请检查后端。');
      });
      
      // 注意：不再需要手动调用sync，事件监听器会自动处理数据同步
      // 数据会在几秒内通过事件监听器自动更新
      
      // 关闭弹窗
      setIsOpen(false);
      setBetAmount('');
      reset();
    }
  }, [isSuccess, address, team.id, betAmount, queryClient, reset]);

  const calculateOdds = () => {
    const userAmount = parseFloat(betAmount) || 0;
    const teamPool = parseFloat(team.total_bet_wei) / 10**18;
    const totalPoolAmount = parseFloat(status?.total_prize_pool_wei || '0') / 10**18;
    const finalPool = totalPoolAmount * 0.9;
    if (teamPool === 0) return 0;
    return (userAmount / teamPool) * finalPool;
  };

  const handleBet = () => {
    console.log('handleBet called');

    if (!betAmount || isNaN(parseFloat(betAmount)) || parseFloat(betAmount) <= 0) {
      console.log('Invalid bet amount:', betAmount);
      alert('请输入有效的下注金额（大于0的数字）');
      return;
    }

    if (!address) {
      console.log('No wallet address');
      alert('请先连接钱包');
      return;
    }

    const amountInWei = parseEther(betAmount);
    
    console.log('正在下注:', {
      teamId: team.id,
      teamName: team.name,
      amount: betAmount,
      amountInWei: amountInWei.toString(),
      contractAddress: CONTRACT_ADDRESS,
      userAddress: address
    });

    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: BET_ABI,
        functionName: 'bet',
        args: [BigInt(team.id)],
        value: amountInWei,
        gas: BigInt(100000), // 设置 gas limit
      });
      console.log('writeContract called successfully');
    } catch (err) {
      console.error('writeContract error:', err);
      alert('调用合约失败，请检查控制台错误信息');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open && !isSuccess) {
      // 关闭时重置状态，如果不是成功关闭
      setBetAmount('');
      reset();
    }
  };

  return (
    <Card className="glass-red glow-hover border-red-400/30 transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-red-300">{team.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-200">总下注: {(parseFloat(team.total_bet_wei) / 10**18).toFixed(6)} ETH</p>
        <p className="text-sm text-red-200">支持者: {team.supporters}</p>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="w-full mt-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-hover">
              下注
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-red border-red-400/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-300">下注 {team.name}</DialogTitle>
              <DialogDescription className="text-red-200">
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
                  className="bg-red-900/50 border-red-400/50 text-white placeholder-red-300"
                />
              </div>
              {betAmount && parseFloat(betAmount) > 0 && (
                <div className="p-4 bg-red-900/30 rounded border border-red-400/30">
                  <p className="text-sm text-red-100">预计收益: {calculateOdds().toFixed(6)} ETH</p>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-900/50 rounded border border-red-500/50">
                  <p className="text-sm text-red-300">错误: {error.message}</p>
                </div>
              )}
              {isSuccess && (
                <div className="p-4 bg-green-900/30 rounded border border-green-400/50">
                  <p className="text-sm text-green-300">✅ 交易成功！</p>
                  <p className="text-xs text-green-400 break-all">交易哈希: {hash}</p>
                </div>
              )}
              <Button
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold glow-hover border border-red-400/50"
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
      <div className="min-h-screen bg-red-gradient flex items-center justify-center relative">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: "url('/bg.png')",
          }}
        />
        <div className="absolute inset-0 bg-black-glass" />
        <div className="text-center glass-red rounded-2xl p-8 glow relative z-10">
          <h1 className="text-2xl mb-4 text-red-100">请先连接钱包</h1>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // 检查游戏状态
  if (status && status.status !== 0) {
    return (
      <div className="min-h-screen bg-red-gradient flex items-center justify-center relative">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: "url('/bg.png')",
          }}
        />
        <div className="absolute inset-0 bg-black-glass" />
        <div className="text-center glass-red rounded-2xl p-8 glow relative z-10">
          <h1 className="text-2xl mb-4 text-red-100">投注已关闭</h1>
          <p className="text-red-200">当前状态：{status.status_text}</p>
          {status.winning_team_id !== null && status.winning_team_id !== 0 && (
            <p className="text-red-300 mt-2">获胜队伍ID: {status.winning_team_id}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-gradient text-white relative">
      {/* 背景图片 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{
          backgroundImage: "url('/bg.png')",
        }}
      />
      <div className="absolute inset-0 bg-black-glass" />

      <header className="p-4 border-b border-red-400/30 relative z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-glow">CS2 Major Betting</h1>
          <ConnectButton />
        </div>
      </header>

      <main className="p-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 glass-red rounded-xl p-6 glow">
            <h2 className="text-2xl font-bold mb-2 text-red-100">选择战队下注</h2>
            <p className="text-red-200">当前总奖池: {totalPool.toFixed(6)} ETH</p>
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
