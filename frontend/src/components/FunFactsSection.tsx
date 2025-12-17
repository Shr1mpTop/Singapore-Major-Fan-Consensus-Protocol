"use client";

import { useStats } from "@/hooks/useBackendData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress"; // Import the new Progress component
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const funFacts = [
    {
      title: "Equivalent in CS2 Skins",
      value: stats?.weapon_equivalents[0]?.name,
      description: `The prize pool could buy ~${
        stats?.weapon_equivalents[0]?.count || 0
      } of these!`,
      image: stats?.weapon_equivalents[0]?.img,
    },
    {
      title: "Total Votes Cast",
      value: stats?.total_votes,
      description: "votes have been cast by the community.",
    },
    {
      title: "Unique Participants",
      value: stats?.total_unique_participants,
      description: "fans have participated in the consensus.",
    },
  ];
  const [currentWeaponIndex, setCurrentWeaponIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const allWeapons = useMemo(() => {
    if (!stats?.weapon_equivalents || stats.weapon_equivalents.length === 0) {
      return [
        {
          name: "AWP | Dragon Lore",
          count: 0,
          img: "/skins/Dragon.webp",
          progress: 0,
          price_usd: 4000,
          raw_count: 0,
        },
      ];
    }
    return stats.weapon_equivalents;
  }, [stats?.weapon_equivalents]);

  // Preload all weapon images
  useEffect(() => {
    if (allWeapons.length === 0) return;

    let loadedCount = 0;
    const totalImages = allWeapons.length;

    const preloadImage = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setImagesLoaded(true);
          }
          resolve();
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === totalImages) {
            setImagesLoaded(true);
          }
          resolve(); // Still resolve on error to not block the UI
        };
        img.src = src;
      });
    };

    // Preload all images
    const preloadPromises = allWeapons.map((weapon) =>
      preloadImage(weapon.img)
    );
    Promise.all(preloadPromises).then(() => {
      setImagesLoaded(true);
    });

    // Reset loading state when weapons change
    setImagesLoaded(false);
  }, [allWeapons]);

  const currentWeapon = allWeapons[currentWeaponIndex] || allWeapons[0];

  const handlePreviousWeapon = () => {
    setCurrentWeaponIndex((prev) =>
      prev > 0 ? prev - 1 : allWeapons.length - 1
    );
  };

  const handleNextWeapon = () => {
    setCurrentWeaponIndex((prev) =>
      prev < allWeapons.length - 1 ? prev + 1 : 0
    );
  };

  return (
    <motion.section
      id="fun-facts-section"
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
            Explore live data from the prize pool.
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
                    <p className="text-xl text-red-200 mb-4">
                      The current prize pool could buy
                    </p>

                    {/* Weapon Navigation */}
                    <div className="relative flex items-center justify-center mb-4 w-full">
                      <button
                        type="button"
                        onClick={handlePreviousWeapon}
                        className="absolute left-0 top-1/2 -translate-y-1/2 p-3 rounded-full bg-red-900/70 hover:bg-red-900/90 transition-colors z-10"
                        disabled={allWeapons.length <= 1}
                        aria-label="Previous weapon"
                      >
                        <ChevronLeft className="h-8 w-8 text-yellow-300" />
                      </button>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentWeaponIndex}
                          className="text-6xl font-black text-yellow-300 drop-shadow-lg w-64 text-center"
                          initial={{ scale: 0.8, opacity: 0, y: 10 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 1.2, opacity: 0, y: -10 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                            duration: 0.3,
                          }}
                          layoutId="weapon-count"
                        >
                          {currentWeapon.count >= 1
                            ? Math.floor(currentWeapon.count).toLocaleString()
                            : currentWeapon.count !== undefined
                            ? currentWeapon.count.toFixed(2)
                            : "0.00"}
                        </motion.div>
                      </AnimatePresence>

                      <button
                        type="button"
                        onClick={handleNextWeapon}
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-3 rounded-full bg-red-900/70 hover:bg-red-900/90 transition-colors z-10"
                        disabled={allWeapons.length <= 1}
                        aria-label="Next weapon"
                      >
                        <ChevronRight className="h-8 w-8 text-yellow-300" />
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentWeaponIndex}
                        className="text-center"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <p className="text-2xl font-bold text-red-100 mb-4">
                          {currentWeapon.name}(s)
                        </p>
                        <motion.img
                          src={currentWeapon.img}
                          alt={currentWeapon.name}
                          className="w-48 h-auto object-contain drop-shadow-lg mb-8 mx-auto"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.1, opacity: 0 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          onError={(e) => {
                            console.error("图片加载失败 (移动端):", {
                              originalSrc: currentWeapon.img,
                              userAgent: navigator.userAgent,
                              error: e,
                            });
                            // 尝试修复常见的问题
                            const img = e.currentTarget;
                            const originalSrc = currentWeapon.img;

                            // 尝试1: 移除文件名末尾的额外空格
                            if (originalSrc.includes("  .webp")) {
                              img.src = originalSrc.replace("  .webp", ".webp");
                              return;
                            }

                            // 尝试2: 使用备用图片
                            img.src = "/skins/Dragon.webp";
                          }}
                        />
                      </motion.div>
                    </AnimatePresence>

                    {/* Progress Bar Section */}
                    <div className="w-full max-w-md">
                      <div className="flex justify-between items-center mb-2 text-red-200">
                        <span>
                          {currentWeapon.count >= 1
                            ? "Can buy multiple"
                            : "Progress to buy one"}
                        </span>
                        <span className="font-semibold text-yellow-300">
                          {currentWeapon.count >= 1
                            ? "100%"
                            : `${(currentWeapon.progress !== undefined
                                ? currentWeapon.progress
                                : 0
                              ).toFixed(1)}%`}
                        </span>
                      </div>
                      <Progress
                        value={
                          currentWeapon.count >= 1
                            ? 100
                            : currentWeapon.progress !== undefined
                            ? currentWeapon.progress
                            : 0
                        }
                      />
                      <p className="text-sm text-red-400 mt-2">
                        Current Value: ${currentWeapon.price_usd.toFixed(2)} USD
                      </p>
                    </div>

                    {/* Weapon Indicator */}
                    <div className="flex justify-center mt-4 space-x-2">
                      {allWeapons.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full ${
                            index === currentWeaponIndex
                              ? "bg-yellow-300"
                              : "bg-red-900/50"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Leaderboard Card has been removed as the feature is no longer supported. */}
        </div>
      </div>
    </motion.section>
  );
}
