'use client';

import { useStats, useLeaderboard } from "@/hooks/useBackendData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress"; // Import the new Progress component

// Helper to format wallet addresses (e.g., 0x1234...5678)
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Fun icons for leaderboard ranks
const rankIcons: { [key: number]: string } = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function FunFactsSection() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();

  const prizeWeapon = useMemo(() => {
    if (!stats?.weapon_equivalents || stats.weapon_equivalents.length === 0) {
      return { 
        name: "AWP | Dragon Lore", 
        count: 0, 
        img: "/skins/Dragon.webp", // Updated to simplified filename
        progress: 0,
        price_usd: 4000
      };
    }
    return stats.weapon_equivalents[0];
  }, [stats?.weapon_equivalents]);
  
  return (
    <motion.section 
      className="py-24 px-4 relative z-10"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-transparent"></div>

      <div className="max-w-7xl mx-auto relative">
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h2 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-yellow-400 via-red-300 to-red-400 bg-clip-text text-transparent text-glow tracking-wider mb-4">
            Fun Facts
          </h2>
          <p className="text-xl text-red-200 max-w-2xl mx-auto">
            Explore live data from the betting pool.
          </p>
           <motion.div
            className="w-40 h-2 bg-gradient-to-r from-yellow-500 to-red-500 mx-auto rounded-full mt-6"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          ></motion.div>
        </motion.div>

        <div className="grid grid-cols-1 gap-12 items-start max-w-4xl mx-auto">
          
          {/* Prize Pool Power Card - NOW ON TOP */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
             <Card className="glass-black p-6 lg:p-8 rounded-2xl border-2 border-red-500/30 h-full">
               <CardHeader className="text-center p-0 mb-6">
                <CardTitle className="text-3xl font-bold text-red-100 tracking-wider">
                  Prize Pool Power
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-center">
                {statsLoading ? (
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-24 w-48 bg-red-900/50 rounded-lg mb-4" />
                    <Skeleton className="h-8 w-3/4 bg-red-900/50 rounded-md" />
                    <Skeleton className="h-4 w-1/2 bg-red-900/50 rounded-md mt-4" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-xl text-red-200 mb-4">The current prize pool could buy</p>
                    <motion.div 
                      className="text-6xl font-black text-yellow-300 drop-shadow-lg mb-4"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 100, damping: 10, delay: 0.2 }}
                    >
                      {typeof prizeWeapon.count === 'number' && !Number.isInteger(prizeWeapon.count) 
                        ? prizeWeapon.count.toFixed(1) 
                        : prizeWeapon.count.toLocaleString()
                      }
                    </motion.div>
                    <p className="text-2xl font-bold text-red-100 mb-4">{prizeWeapon.name}(s)</p>
                    <motion.img 
                      src={prizeWeapon.img} 
                      alt={prizeWeapon.name} 
                      className="w-48 h-auto object-contain drop-shadow-lg mb-8"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      onError={(e) => {
                        console.error('图片加载失败 (移动端):', {
                          originalSrc: prizeWeapon.img,
                          userAgent: navigator.userAgent,
                          error: e
                        });
                        // 尝试修复常见的问题
                        const img = e.currentTarget;
                        const originalSrc = prizeWeapon.img;
                        
                        // 尝试1: 移除文件名末尾的额外空格
                        if (originalSrc.includes('  .webp')) {
                          img.src = originalSrc.replace('  .webp', '.webp');
                          return;
                        }
                        
                        // 尝试2: 使用备用图片
                        img.src = '/skins/Dragon.webp';
                      }}
                      loading="lazy"
                    />
                    
                    {/* Progress Bar Section */}
                    <div className="w-full max-w-md">
                      <div className="flex justify-between items-center mb-2 text-red-200">
                        <span>Progress to next one</span>
                        <span className="font-semibold text-yellow-300">{prizeWeapon.progress.toFixed(2)}%</span>
                      </div>
                      <Progress value={prizeWeapon.progress} />
                      <p className="text-sm text-red-400 mt-2">
                        Current Value: ${prizeWeapon.price_usd.toFixed(2)} USD
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Leaderboard Card - NOW AT THE BOTTOM */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Card className="glass-black p-6 lg:p-8 rounded-2xl border-2 border-red-500/30 h-full">
              <CardHeader className="text-center p-0 mb-6">
                <CardTitle className="text-3xl font-bold text-red-100 tracking-wider">
                  Top Bettors Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-4">
                  {leaderboardLoading ? (
                    [...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full bg-red-900/50 rounded-lg" />
                    ))
                  ) : (
                    leaderboard?.map((bettor, index) => (
                      <motion.div
                        key={bettor.address}
                        className="flex items-center justify-between bg-red-900/30 p-4 rounded-lg"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <div className="flex items-center space-x-4">
                          <span className="text-2xl font-bold w-8 text-center">
                            {rankIcons[bettor.rank] || bettor.rank}
                          </span>
                          <span className="font-semibold text-red-200">{formatAddress(bettor.address)}</span>
                        </div>
                        <span className="font-bold text-yellow-300 text-lg">
                          {bettor.total_bet_eth.toFixed(3)} ETH
                        </span>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </motion.section>
  );
}
