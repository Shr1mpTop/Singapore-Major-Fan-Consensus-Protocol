"use client";

import {
  useStatus,
  useTeams,
  useStats,
  useEthPrice,
} from "@/hooks/useBackendData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedNumber, SlotMachineNumber } from "@/components/AnimatedNumber";
import { FunFactsSection } from "@/components/FunFactsSection";
import { ViewYourVotesSection } from "@/components/ViewYourVotesSection"; // Import the new component

// Contract ABI - vote function
const VOTE_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_teamId", type: "uint256" }],
    name: "vote",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Contract address
const CONTRACT_ADDRESS: `0x${string}` = (process.env
  .NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xb5c4bea741cea63b2151d719b2cca12e80e6c7e8") as `0x${string}`;

function HeroSection({
  onScrollToVoting,
  status,
}: {
  onScrollToVoting: () => void;
  status?: any;
}) {
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [particles, setParticles] = useState<
    Array<{ x: number; y: number; delay: number; duration: number }>
  >([]);

  useEffect(() => {
    // Only run on client side
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Generate particles data only once on client side
    const particleData = [...Array(20)].map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
    }));
    setParticles(particleData);
  }, []);

  const isContestEnded = status?.status === 2;
  const buttonText = isContestEnded ? "View Results" : "Start Voting";
  const handleButtonClick = isContestEnded
    ? () => {
        window.location.href = "/withdraw";
      }
    : onScrollToVoting;

  return (
    <motion.section
      id="hero-section"
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Hero section specific overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-red-900/10"></div>

      <div className="text-center max-w-4xl relative z-10">
        <motion.h1
          className="text-6xl md:text-8xl lg:text-9xl font-black tracking-wider leading-tight mb-6 relative overflow-hidden"
          initial={{ opacity: 0, y: -100, rotateX: -90 }}
          animate={{
            opacity: 1,
            y: 0,
            rotateX: 0,
          }}
          transition={{
            type: "spring",
            damping: 12,
            stiffness: 100,
            duration: 1.2,
            delay: 0.3,
          }}
        >
          <motion.span
            className="inline-block bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              backgroundSize: "200% 200%",
            }}
          >
            CS2 Singapore Major 2026
          </motion.span>
          {/* Knife edge flash animation */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 0.8,
              delay: 1.5,
              ease: "easeInOut",
            }}
            style={{
              mixBlendMode: "overlay",
              opacity: 0.8,
            }}
          />
        </motion.h1>
        <motion.p
          className="text-xl md:text-2xl mb-8 text-red-100"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Rally Behind Your Champions - Support Your Team, Share the Glory
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", damping: 10, stiffness: 400 }}
          >
            <Button
              size="lg"
              className="relative bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-10 py-5 text-lg glow-hover border border-red-400/50 rounded-xl overflow-hidden group shadow-2xl shadow-red-500/25"
              onClick={handleButtonClick}
            >
              {/* Animated background gradient */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-yellow-400/0 via-yellow-400/20 to-yellow-400/0"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />

              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: "-150%" }}
                animate={{
                  x: ["150%", "-150%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2,
                }}
              />

              <span className="relative z-10 flex items-center space-x-2">
                <span>{buttonText}</span>
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  →
                </motion.span>
              </span>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function StatsSection({
  stats,
  status,
  statsLoading,
  statusLoading,
}: {
  stats: any;
  status: any;
  statsLoading: boolean;
  statusLoading: boolean;
}) {
  const totalParticipants = stats?.total_unique_participants || 0;
  const totalPrizePoolEth = status?.total_prize_pool_eth || 0;
  const { data: ethPrice, isLoading: ethPriceLoading } = useEthPrice();
  const ethPriceValue = ethPrice ? parseFloat(ethPrice.price) : 0;
  const totalPrizePoolUsd = totalPrizePoolEth * ethPriceValue;

  // Detect data source
  const dataSource = ethPrice
    ? ethPrice.price === "3000"
      ? "Fixed Rate"
      : ethPrice.symbol === "ETHUSD"
      ? "CoinGecko"
      : "Binance"
    : "Loading...";

  return (
    <motion.section
      id="stats-section"
      className="py-24 px-4 relative z-10 overflow-hidden"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      {/* Stats section overlay - very subtle for natural flow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/3 to-transparent"></div>

      <div className="max-w-7xl mx-auto relative">
        {/* Hero Title */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <motion.h2
            className="text-7xl md:text-9xl lg:text-10xl font-black mb-6 bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow tracking-wider"
            initial={{ opacity: 0, y: -30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            LIVE STATS
          </motion.h2>
          <motion.div
            className="w-40 h-2 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
          ></motion.div>
        </motion.div>

        {/* Stats Grid - Single column vertical layout */}
        <div className="grid grid-cols-1 gap-6 lg:gap-8 max-w-2xl mx-auto">
          {/* Total Prize Pool */}
          <motion.div
            className="group relative"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <div className="relative glass-red rounded-3xl p-6 lg:p-8 text-center transform transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-500/30 h-full border border-red-500/20 group-hover:border-red-400/40 backdrop-blur-xl">
              {/* Enhanced neumorphism shadow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.1)] opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>

              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/0 via-red-400/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>

              <div className="relative z-10 flex flex-col justify-center h-full">
                <motion.div
                  className="text-red-300 text-base lg:text-lg font-semibold mb-4 uppercase tracking-wider"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  viewport={{ once: true }}
                >
                  Total Prize Pool
                </motion.div>
                <div className="space-y-3">
                  {statusLoading ? (
                    <Skeleton className="h-10 w-28 bg-red-900/50 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <motion.div
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.7 }}
                        viewport={{ once: true }}
                      >
                        <p className="text-3xl lg:text-4xl font-black text-red-100 mb-1 drop-shadow-lg">
                          <SlotMachineNumber
                            value={totalPrizePoolEth}
                            duration={5}
                          />
                          <span className="text-xl lg:text-2xl ml-1 text-red-300">
                            ETH
                          </span>
                        </p>
                      </motion.div>
                      <motion.div
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.9 }}
                        viewport={{ once: true }}
                      >
                        {ethPriceLoading ? (
                          <Skeleton className="h-6 w-20 bg-red-900/50 mx-auto rounded-lg" />
                        ) : (
                          <p className="text-xl lg:text-2xl font-bold text-yellow-300 drop-shadow-md">
                            $
                            <SlotMachineNumber
                              value={totalPrizePoolUsd}
                              duration={5}
                              decimals={2}
                            />
                          </p>
                        )}
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Participants */}
          <motion.div
            className="group relative"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <div className="relative glass-red rounded-3xl p-6 lg:p-8 text-center transform transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-500/30 h-full border border-red-500/20 group-hover:border-red-400/40 backdrop-blur-xl">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.1)] opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/0 via-red-400/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>

              <div className="relative z-10 flex flex-col justify-center h-full">
                <motion.div
                  className="text-red-300 text-base lg:text-lg font-semibold mb-4 uppercase tracking-wider"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  viewport={{ once: true }}
                >
                  Participants
                </motion.div>
                <div>
                  {statsLoading ? (
                    <Skeleton className="h-10 w-20 bg-red-900/50 mx-auto rounded-lg" />
                  ) : (
                    <motion.p
                      className="text-3xl lg:text-4xl font-black text-red-100 drop-shadow-lg"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.8 }}
                      viewport={{ once: true }}
                    >
                      <AnimatedNumber
                        value={totalParticipants}
                        duration={0.8}
                        decimals={0}
                      />
                    </motion.p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Game Status */}
          <motion.div
            className="group relative"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="relative glass-red rounded-3xl p-6 lg:p-8 text-center transform transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-500/30 h-full border border-red-500/20 group-hover:border-red-400/40 backdrop-blur-xl">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.1)] opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/0 via-red-400/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>

              <div className="relative z-10 flex flex-col justify-center h-full">
                <motion.div
                  className="text-red-300 text-base lg:text-lg font-semibold mb-4 uppercase tracking-wider"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                  viewport={{ once: true }}
                >
                  Game Status
                </motion.div>
                <div className="flex flex-col items-center space-y-3">
                  {statusLoading ? (
                    <Skeleton className="h-10 w-24 bg-red-900/50 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <motion.p
                        className="text-2xl lg:text-3xl font-black text-red-100 uppercase tracking-wide drop-shadow-lg"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.9 }}
                        viewport={{ once: true }}
                      >
                        {status?.status_text}
                      </motion.p>
                      {/* Status indicator */}
                      <motion.div
                        className="flex items-center space-x-2"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 1.1 }}
                        viewport={{ once: true }}
                      >
                        <motion.div
                          className={`w-3 h-3 rounded-full ${
                            status?.status_text?.toLowerCase() === "open"
                              ? "bg-green-400 shadow-lg shadow-green-400/50"
                              : "bg-yellow-400 shadow-lg shadow-yellow-400/50"
                          }`}
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [1, 0.7, 1],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                        <span
                          className={`text-sm font-medium ${
                            status?.status_text?.toLowerCase() === "open"
                              ? "text-green-300"
                              : status?.status_text?.toLowerCase() ===
                                "finished"
                              ? "text-red-300"
                              : "text-yellow-300"
                          }`}
                        >
                          {status?.status_text?.toLowerCase() === "open"
                            ? "Active"
                            : status?.status_text?.toLowerCase() === "finished"
                            ? "Finished"
                            : "Pending"}
                        </span>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ETH/USD Live Price */}
          <motion.div
            className="group relative"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="relative glass-red rounded-3xl p-6 lg:p-8 text-center transform transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-red-500/30 h-full border border-red-500/20 group-hover:border-red-400/40 backdrop-blur-xl">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-500/10 via-transparent to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.1)] opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-red-500/0 via-red-400/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>

              <div className="relative z-10 flex flex-col justify-center h-full">
                <motion.div
                  className="text-red-300 text-base lg:text-lg font-semibold mb-4 uppercase tracking-wider"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  viewport={{ once: true }}
                >
                  ETH/USD Live Price
                </motion.div>
                <div className="space-y-2">
                  {ethPriceLoading ? (
                    <Skeleton className="h-10 w-28 bg-red-900/50 mx-auto rounded-lg" />
                  ) : (
                    <motion.div
                      className="text-center"
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: 1.0 }}
                      viewport={{ once: true }}
                    >
                      <p className="text-3xl lg:text-4xl font-black text-yellow-300 drop-shadow-lg">
                        $<AnimatedNumber value={ethPriceValue} duration={1} />
                      </p>
                    </motion.div>
                  )}
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 1.2 }}
                    viewport={{ once: true }}
                  >
                    <div className="text-xs lg:text-sm text-red-400 font-medium bg-red-900/20 px-3 py-1 rounded-full inline-block">
                      📊 Data Source: {dataSource}
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function VotingSection({
  teams,
  status,
  teamsLoading,
}: {
  teams: any[];
  status: any;
  teamsLoading: boolean;
}) {
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [voteAmount, setVoteAmount] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (
      isSuccess &&
      address &&
      selectedTeam !== null &&
      selectedTeam !== undefined
    ) {
      // Transaction successful - backend event listeners will automatically sync the on-chain data
      console.log(
        "Vote transaction successful, backend will sync automatically via event listeners"
      );

      // Invalidate queries to refetch data after a successful vote
      // Add a delay to allow backend event listeners to process the transaction
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["teams"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        queryClient.invalidateQueries({ queryKey: ["status"] });
      }, 5000); // Wait 5 seconds for backend to sync
    }
  }, [isSuccess, address, selectedTeam, voteAmount, queryClient]);

  const handleVote = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTeam && voteAmount) {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: VOTE_ABI,
        functionName: "vote",
        args: [BigInt(selectedTeam.id)],
        value: parseEther(voteAmount),
      });
    }
  };

  const handleOpenDialog = (team: any) => {
    setSelectedTeam(team);
    setVoteAmount("");
    reset();
    setIsOpen(true);
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
  };

  // Find the winning team
  const winningTeam = teams.find((team) => team.is_winner);

  return (
    <motion.section
      id="voting-section"
      className="py-24 px-4 relative z-10"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.2 }}
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-transparent"></div>

      <div className="max-w-7xl mx-auto relative">
        {/* Section Title */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h2 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow tracking-wider mb-4">
            Place Your Vote
          </h2>
          <p className="text-xl text-red-200 max-w-2xl mx-auto">
            Select a team to see their stats and place your vote. The prize pool
            is distributed to the winners.
          </p>
          <motion.div
            className="w-40 h-2 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full mt-6"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          ></motion.div>
        </motion.div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamsLoading
            ? [...Array(8)].map((_, i) => (
                <Card key={i} className="glass-red p-4 rounded-xl">
                  <Skeleton className="h-32 w-full bg-red-900/50 rounded-lg mb-4" />
                  <Skeleton className="h-6 w-3/4 bg-red-900/50 rounded-md mb-2" />
                  <Skeleton className="h-4 w-1/2 bg-red-900/50 rounded-md" />
                </Card>
              ))
            : teams.map((team) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className={`relative rounded-2xl overflow-hidden group transform transition-all duration-300 ${
                    winningTeam
                      ? winningTeam.id === team.id
                        ? "shadow-2xl shadow-yellow-400/80 border-4 border-yellow-400 ring-4 ring-yellow-400/30"
                        : "opacity-50 grayscale"
                      : ""
                  }`}
                >
                  <Card
                    className="glass-black p-6 rounded-2xl h-full flex flex-col items-center text-center cursor-pointer border-2 border-transparent group-hover:border-red-500 transition-colors duration-300"
                    onClick={() => handleOpenDialog(team)}
                  >
                    {/* Winner Badge */}
                    {winningTeam && winningTeam.id === team.id && (
                      <>
                        {/* Glow Effect */}
                        <motion.div
                          className="absolute top-3 right-3 w-32 h-12 bg-yellow-400/20 rounded-full blur-xl"
                          animate={{
                            opacity: [0.3, 0.8, 0.3],
                            scale: [1, 1.2, 1],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                        <motion.div
                          className="absolute top-3 right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-black px-6 py-2 rounded-full text-lg shadow-2xl border-2 border-yellow-300 z-10"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: "spring",
                            damping: 10,
                            stiffness: 150,
                            delay: 0.5,
                          }}
                          whileHover={{ scale: 1.1 }}
                        >
                          🏆 WINNER 🏆
                        </motion.div>
                      </>
                    )}
                    <CardHeader className="p-0 mb-4">
                      <motion.img
                        src={team.logo_url}
                        alt={team.name}
                        className="w-24 h-24 mx-auto object-contain drop-shadow-lg"
                        whileHover={{
                          rotate: [0, -10, 10, 0],
                          transition: { duration: 0.5 },
                        }}
                      />
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col flex-grow justify-center">
                      <CardTitle className="text-2xl font-bold text-red-100 mb-2">
                        {team.name}
                      </CardTitle>
                      <p className="text-red-300">
                        Total Votes:{" "}
                        <span className="font-semibold text-yellow-300">
                          {(team.total_vote_amount_eth ?? 0).toFixed(4)} ETH
                        </span>
                      </p>
                      <p className="text-sm text-red-400 mt-1">
                        {team.supporter_count} Supporters
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
        </div>
      </div>

      {/* Voting Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-red text-white border-red-500/50">
          <DialogHeader>
            {selectedTeam && (
              <div className="flex items-center space-x-4 mb-4">
                <img
                  src={selectedTeam.logo_url}
                  alt={selectedTeam.name}
                  className="w-16 h-16 object-contain"
                />
                <div>
                  <DialogTitle className="text-3xl font-bold text-red-100">
                    Vote for {selectedTeam.name}
                  </DialogTitle>
                  <DialogDescription className="text-red-300">
                    Your vote will be added to this team's prize pool.
                  </DialogDescription>
                </div>
              </div>
            )}
          </DialogHeader>

          {!isSuccess && !isConfirming && !isPending && (
            <form onSubmit={handleVote} className="space-y-6">
              <div>
                <label
                  htmlFor="voteAmount"
                  className="block text-sm font-medium text-red-200 mb-2"
                >
                  Vote Amount (ETH)
                </label>
                <Input
                  id="voteAmount"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={voteAmount}
                  onChange={(e) => setVoteAmount(e.target.value)}
                  className="bg-red-900/50 border-red-500/50 text-white placeholder-red-400 focus:ring-red-400"
                  placeholder="e.g., 0.01"
                  required
                />
              </div>

              {isConnected ? (
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 text-lg glow-hover border border-red-400/50"
                  disabled={isPending || !voteAmount}
                >
                  {isPending ? "Waiting for wallet..." : `Place Vote`}
                </Button>
              ) : (
                <div className="text-center p-4 bg-red-900/50 rounded-lg">
                  <p className="font-semibold text-yellow-300">
                    Please connect your wallet to vote.
                  </p>
                </div>
              )}
              {error && (
                <div className="text-red-400 text-sm mt-2 text-center break-words">
                  <p>Error: {error.message.split("(")[0]}</p>
                </div>
              )}
            </form>
          )}

          {(isConfirming || isPending) && (
            <div className="flex flex-col items-center justify-center space-y-4 p-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-t-red-400 border-red-800 rounded-full"
              />
              <p className="text-xl font-semibold text-red-200">
                {isPending
                  ? "Waiting for signature..."
                  : "Processing transaction..."}
              </p>
              <p className="text-red-300 text-sm text-center">
                Your transaction is being confirmed on the blockchain. This may
                take a moment.
              </p>
              {hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-yellow-300 hover:text-yellow-200 underline mt-2"
                >
                  View on Etherscan
                </a>
              )}
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 150 }}
                className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center"
              >
                <svg
                  className="w-12 h-12 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </motion.div>
              <p className="text-2xl font-bold text-green-300">
                Vote Placed Successfully!
              </p>
              <p className="text-red-200">
                You have successfully voted{" "}
                <span className="font-bold text-yellow-300">
                  {voteAmount} ETH
                </span>{" "}
                for{" "}
                <span className="font-bold text-yellow-300">
                  {selectedTeam?.name}
                </span>
                .
              </p>
              {hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-yellow-300 hover:text-yellow-200 underline mt-2"
                >
                  View on Etherscan
                </a>
              )}
              <Button
                onClick={handleCloseDialog}
                className="mt-6 bg-red-600 hover:bg-red-700"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

function MainContent() {
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: status, isLoading: statusLoading } = useStatus();
  const { data: stats, isLoading: statsLoading } = useStats();

  const votingSectionRef = useRef<HTMLDivElement>(null);

  const handleScrollToVoting = () => {
    votingSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <HeroSection onScrollToVoting={handleScrollToVoting} status={status} />
      <StatsSection
        stats={stats}
        status={status}
        statsLoading={statsLoading}
        statusLoading={statusLoading}
      />
      <div ref={votingSectionRef}>
        <VotingSection
          teams={teams || []}
          status={status}
          teamsLoading={teamsLoading}
        />
      </div>
      <ViewYourVotesSection />
      <FunFactsSection />
    </>
  );
}

export default function Home() {
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

      {/* 全局背景层 - 贯穿整个页面 */}
      <div className="fixed inset-0 z-0">
        {/* 渐变背景 - 从上到下，从暗到亮 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-red-900/40 to-transparent"></div>

        {/* 动态光球效果 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-500/6 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-red-500/3 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-red-500/5 to-transparent rounded-full blur-3xl"></div>
      </div>

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
        <MainContent />
      </div>
    </div>
  );
}
