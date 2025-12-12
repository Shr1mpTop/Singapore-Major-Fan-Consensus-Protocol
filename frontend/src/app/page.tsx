'use client';

import Link from "next/link";
import { useStatus, useTeams } from "@/hooks/useBackendData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: status, isLoading: statusLoading } = useStatus();
  const { data: teams, isLoading: teamsLoading } = useTeams();

  const totalParticipants = teams?.reduce((sum, team) => sum + team.supporters, 0) || 0;
  const totalPrizePoolEth = status ? parseFloat(status.total_prize_pool_wei) / 10**18 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/cs2-bg.jpg')] bg-cover bg-center opacity-20" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <div className="text-center max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              CS2 Singapore Major 2026
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-slate-300">
              冠军预测大赛 - 预测冠军，赢取奖金
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-4 text-lg">
                立即参与 (Enter App)
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Live Stats */}
      <div className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">实时数据</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-yellow-400">总奖池</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl font-bold">{totalPrizePoolEth.toFixed(4)} ETH</p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-blue-400">参与人数</CardTitle>
              </CardHeader>
              <CardContent>
                {teamsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{totalParticipants}</p>
                )}
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-green-400">游戏状态</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-2xl font-bold">{status?.status_text}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
