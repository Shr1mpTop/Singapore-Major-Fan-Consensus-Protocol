'use client';

import { useStatus, useTeams, useStats } from "@/hooks/useBackendData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

// 页面组件
function HeroSection({ onScrollToBetting }: { onScrollToBetting: () => void }) {
  return (
    <motion.section
      className="min-h-screen flex items-center justify-center px-4 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <div className="text-center max-w-4xl glass-red rounded-2xl p-8 glow">
        <motion.h1
          className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          CS2 Singapore Major 2026
        </motion.h1>
        <motion.p
          className="text-xl md:text-2xl mb-8 text-red-100"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          冠军预测大赛 - 预测冠军，赢取奖金
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-8 py-4 text-lg glow-hover border border-red-400/50"
            onClick={onScrollToBetting}
          >
            开始投注 (Start Betting)
          </Button>
        </motion.div>
      </div>
    </motion.section>
  );
}

function StatsSection({ stats, status, statsLoading, statusLoading }: {
  stats: any;
  status: any;
  statsLoading: boolean;
  statusLoading: boolean;
}) {
  const totalParticipants = stats?.total_unique_participants || 0;
  const totalPrizePoolEth = status?.total_prize_pool_wei ? parseFloat(status.total_prize_pool_wei) / 10**18 : 0;

  return (
    <motion.section
      className="py-16 px-4 relative z-10"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl font-bold text-center mb-12 text-glow"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          实时数据
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card className="glass-red glow-hover border-red-400/30">
              <CardHeader>
                <CardTitle className="text-red-300">总奖池</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <Skeleton className="h-8 w-24 bg-red-900/50" />
                ) : (
                  <p className="text-2xl font-bold text-red-100">{totalPrizePoolEth.toFixed(4)} ETH</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="glass-red glow-hover border-red-400/30">
              <CardHeader>
                <CardTitle className="text-red-300">参与人数</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16 bg-red-900/50" />
                ) : (
                  <p className="text-2xl font-bold text-red-100">{totalParticipants}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Card className="glass-red glow-hover border-red-400/30">
              <CardHeader>
                <CardTitle className="text-red-300">游戏状态</CardTitle>
              </CardHeader>
              <CardContent>
                {statusLoading ? (
                  <Skeleton className="h-8 w-20 bg-red-900/50" />
                ) : (
                  <p className="text-2xl font-bold text-red-100">{status?.status_text}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function BettingSection({ teams, status, teamsLoading }: {
  teams: any[];
  status: any;
  teamsLoading: boolean;
}) {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const { address, isConnected } = useAccount();

  // 这里可以添加下注逻辑，暂时保持简单

  return (
    <motion.section
      className="min-h-screen py-16 px-4 relative z-10"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1 }}
      viewport={{ once: true }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.h2
          className="text-3xl font-bold text-center mb-12 text-glow"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          选择战队下注
        </motion.h2>

        {!isConnected ? (
          <motion.div
            className="text-center glass-red rounded-xl p-8 glow"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl mb-4 text-red-100">请先连接钱包</h3>
            <ConnectButton />
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <Skeleton className="h-6 w-20" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-16 mb-2" />
                      <Skeleton className="h-4 w-12" />
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              teams?.map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card className="glass-red glow-hover border-red-400/30 cursor-pointer transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="text-red-300">{team.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-red-200">总下注: {(parseFloat(team.total_bet_wei) / 10**18).toFixed(6)} ETH</p>
                      <p className="text-sm text-red-200">支持者: {team.supporters}</p>
                      <Button className="w-full mt-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-hover">
                        下注
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

export default function Home() {
  const [currentSection, setCurrentSection] = useState(0);
  const { scrollY } = useScroll();
  const { data: status, isLoading: statusLoading } = useStatus();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: stats, isLoading: statsLoading } = useStats();

  // 监听滚动位置来切换页面状态
  useEffect(() => {
    const unsubscribe = scrollY.onChange((value) => {
      const sectionHeight = window.innerHeight;
      const newSection = Math.floor(value / sectionHeight);
      setCurrentSection(Math.min(newSection, 2)); // 最多3个section
    });

    return unsubscribe;
  }, [scrollY]);

  const scrollToBetting = () => {
    const bettingSection = document.getElementById('betting-section');
    bettingSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-red-gradient text-white relative overflow-x-hidden">
      {/* 背景图片 */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: "url('/bg.png')",
        }}
      />

      {/* 背景装饰效果 */}
      <div className="fixed inset-0 bg-black-glass" />

      {/* 固定右上角钱包连接 */}
      <motion.div
        className="fixed top-4 right-4 z-50"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
      >
        <ConnectButton />
      </motion.div>

      {/* 页面内容 */}
      <div className="relative z-10">
        <HeroSection onScrollToBetting={scrollToBetting} />
        <StatsSection
          stats={stats}
          status={status}
          statsLoading={statsLoading}
          statusLoading={statusLoading}
        />
        <div id="betting-section">
          <BettingSection
            teams={teams || []}
            status={status}
            teamsLoading={teamsLoading}
          />
        </div>
      </div>

      {/* 页面指示器 */}
      <motion.div
        className="fixed left-4 top-1/2 transform -translate-y-1/2 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.5 }}
      >
        <div className="flex flex-col space-y-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-300 ${
                currentSection === index ? 'bg-red-400 glow' : 'bg-red-600/50'
              }`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const sections = ['hero-section', 'stats-section', 'betting-section'];
                const element = document.getElementById(sections[index]);
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
