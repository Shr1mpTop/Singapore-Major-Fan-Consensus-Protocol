"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStatus, useTeams, useStats } from "@/hooks/useBackendData";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Coins,
  Target,
  Award,
  Wallet,
  Sparkles,
  Star,
} from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

// 合约ABI - withdraw函数和userBets函数
const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_teamId", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "userBets",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// 合约地址
const CONTRACT_ADDRESS: `0x${string}` = (process.env
  .NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xb5c4bea741cea63b2151d719b2cca12e80e6c7e8") as `0x${string}`;

interface BettingHistory {
  total_bets: number;
  total_invested_eth: number;
  total_returned_eth: number;
  net_profit_eth: number;
  game_status: number;
  winning_team_id: number | null;
  bets: {
    team_id: number;
    team_name: string;
    bet_amount_eth: number;
    returned_amount_eth: number;
    profit_loss_eth: number;
    status: string;
    timestamp: string | null;
  }[];
}

export function WithdrawSection() {
  const { address, isConnected } = useAccount();
  const { data: status } = useStatus();
  const { data: teams } = useTeams();
  const { data: stats } = useStats();
  const [withdrawingTeam, setWithdrawingTeam] = useState<number | null>(null);

  // Create an array to store contract calls for all teams
  const userBetCalls = [];

  if (teams && address && isConnected) {
    // Properly handle the readonly array type
    const teamsData = Array.isArray(teams) ? [...teams] : [];

    for (const team of teamsData) {
      userBetCalls.push({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "userBets" as const,
        args: [address as `0x${string}`, BigInt(team.id)],
      });
    }
  }

  // Get user's betting history and profit/loss calculation
  const { data: bettingHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["bettingHistory", address],
    queryFn: async () => {
      if (!address) return null;

      // Get contract bets
      const contractResponse = await axios.get(
        `${
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001/api"
        }/user_contract_bets/${address}`
      );
      const contractBets = contractResponse.data.bets || [];

      // Get game state and teams info
      const [statusRes, teamsRes, statsRes] = await Promise.all([
        axios.get(
          `${
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001/api"
          }/status`
        ),
        axios.get(
          `${
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001/api"
          }/historical_team_stats` // 使用历史数据而不是当前合约数据
        ),
        axios.get(
          `${
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001/api"
          }/stats`
        ),
      ]);

      const gameStatus = statusRes.data;
      const teams = teamsRes.data.teams || [];
      const stats = statsRes.data;

      // Calculate profits
      let totalInvested = 0;
      let totalReturned = 0;
      const betHistory = [];

      for (const bet of contractBets) {
        totalInvested += bet.amount_eth;

        let returnedAmount = 0;
        let profitLoss = -bet.amount_eth;
        let status = "Lost";

        if (gameStatus.status === 2) {
          // Finished
          if (bet.team_id === gameStatus.winning_team_id) {
            // Find winner team total
            const winnerTeam = teams.find(
              (t: any) => t.id === gameStatus.winning_team_id
            );
            if (winnerTeam && winnerTeam.prize_pool_eth > 0) {
              const distributablePrize = stats.total_prize_pool_eth * 0.9;
              returnedAmount =
                (bet.amount_eth / winnerTeam.prize_pool_eth) *
                distributablePrize;
              profitLoss = returnedAmount - bet.amount_eth;
              status = "Won";
              totalReturned += returnedAmount;
            }
          }
        }

        betHistory.push({
          team_id: bet.team_id,
          team_name: bet.team_name,
          bet_amount_eth: bet.amount_eth,
          returned_amount_eth: returnedAmount,
          profit_loss_eth: profitLoss,
          status: status,
          source: "contract",
        });
      }

      return {
        total_bets: contractBets.length,
        total_invested_eth: totalInvested,
        total_returned_eth: totalReturned,
        net_profit_eth: totalReturned - totalInvested,
        game_status: gameStatus.status,
        winning_team_id: gameStatus.winning_team_id,
        bets: betHistory,
      };
    },
    enabled: !!address,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Get user's betting records from contract (for withdrawal)
  const { data: userBetResults, isLoading: contractLoading } = useReadContracts(
    {
      contracts: userBetCalls,
      query: {
        enabled: !!address && isConnected && userBetCalls.length > 0,
      },
    }
  );

  // Process the results into user bets (for withdrawal)
  const userBets: UserBet[] = [];

  if (userBetResults && teams && address && isConnected) {
    const teamsData = Array.isArray(teams) ? [...teams] : [];

    for (let i = 0; i < teamsData.length; i++) {
      const team = teamsData[i];
      const betAmount = userBetResults[i]?.result || BigInt(0);

      if (betAmount > 0) {
        userBets.push({
          team_id: team.id,
          amount_wei: betAmount.toString(),
          amount_eth: Number(betAmount) / 1e18,
        });
      }
    }
  }

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

  // 计算用户最终可以体现的金额
  const calculateWithdrawableAmount = (bet: UserBet) => {
    if (!status || !stats || !teams) return 0;

    if (status.status === 3) {
      // Refunding - 全额退款
      return bet.amount_eth;
    } else if (status.status === 2) {
      // Finished - 奖金计算
      if (bet.team_id === status.winning_team_id) {
        // 找到冠军队伍的总下注额
        const winnerTeam = teams.find(
          (team) => team.id === status.winning_team_id
        );
        if (winnerTeam) {
          const totalDistributable = stats.total_prize_pool_eth * 0.9; // 扣除10%公益金
          const winnerTotalBet = winnerTeam.prize_pool_eth;
          return (bet.amount_eth / winnerTotalBet) * totalDistributable;
        }
      }
    }
    return 0;
  };

  // 检查用户是否是赢家
  const isWinner = (teamId: number) => {
    return status?.status === 2 && teamId === status.winning_team_id;
  };

  // Donut chart constants
  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const distributableRatio = 0.9;
  const distributableLength = donutCircumference * distributableRatio;
  const charityLength = donutCircumference - distributableLength;

  const handleWithdraw = async (teamId: number) => {
    if (!address) return;

    try {
      setWithdrawingTeam(teamId);

      // Directly call contract withdraw function
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "withdraw",
        args: [BigInt(teamId)],
      });
    } catch (error) {
      console.error("Withdraw error:", error);
      let message = "Withdrawal failed";

      if (error instanceof Error) {
        message = error.message;
      }

      alert(message);
    } finally {
      setWithdrawingTeam(null);
    }
  };

  // Check if withdrawal is allowed
  const canWithdraw = status?.status === 2 || status?.status === 3; // Finished or Refunding
  const hasWithdrawableBets =
    userBets && userBets.some((bet) => calculateWithdrawableAmount(bet) > 0);

  if (!address) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-black p-8 rounded-3xl border-2 border-red-500/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-100 flex items-center justify-center gap-3">
              <Wallet className="w-8 h-8 text-red-400" />
              Withdraw Prize
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-6xl mb-4"
              >
                🔗
              </motion.div>
              <p className="text-red-200 text-lg font-medium">
                Please connect your wallet first
              </p>
              <p className="text-red-300 text-sm mt-2">
                Connect your wallet to view your betting history and withdraw
                prizes
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!canWithdraw) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-black p-8 rounded-3xl border-2 border-red-500/30 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-100 flex items-center justify-center gap-3">
              <Trophy className="w-8 h-8 text-red-400" />
              Withdraw Prize
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="text-6xl mb-4"
              >
                ⏳
              </motion.div>
              <p className="text-red-200 text-lg font-medium mb-2">
                Current game status: {status?.status_text || "Unknown"}
              </p>
              <p className="text-red-300 text-sm">
                You can only withdraw prizes after the match ends
              </p>
              <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-500/20">
                <p className="text-yellow-400 text-sm">
                  💡 Game must be in "Finished" or "Refunding" status to
                  withdraw
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="glass-black p-8 rounded-3xl border-2 border-red-700/30 shadow-md relative overflow-hidden bg-red-900/5">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/8 via-red-800/6 to-red-700/6" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-700/10 rounded-full blur-sm" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-700/8 rounded-full blur-sm" />

        <CardHeader className="relative z-10 pb-6">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="p-3 bg-red-500/20 rounded-full">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">
              Prize Pool
            </CardTitle>
          </motion.div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-8">
          {/* Prize Pool Display */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6 p-6 bg-red-900/6 rounded-2xl border border-red-700/25"
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <Coins className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-300">Prize Pool</h3>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-center gap-6">
                <motion.div
                  className="flex-shrink-0 w-36 h-36 flex items-center justify-center"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8 }}
                >
                  <svg className="w-full h-full" viewBox="0 0 120 120">
                    <defs>
                      <linearGradient
                        id="distGrad"
                        x1="0%"
                        x2="100%"
                        y1="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ff8a8a" />
                        <stop offset="100%" stopColor="#ff3b3b" />
                      </linearGradient>
                      <linearGradient
                        id="charityGrad"
                        x1="0%"
                        x2="100%"
                        y1="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ffd7d7" />
                        <stop offset="100%" stopColor="#ffbdbd" />
                      </linearGradient>
                    </defs>
                    <g transform="translate(60,60)">
                      <circle
                        r={donutRadius}
                        fill="none"
                        stroke="#2b0a0a"
                        strokeWidth="24"
                        opacity="0.18"
                      />

                      <motion.circle
                        r={donutRadius}
                        fill="none"
                        stroke="url(#distGrad)"
                        strokeWidth="24"
                        strokeLinecap="round"
                        strokeDasharray={`${distributableLength} ${charityLength}`}
                        initial={{ strokeDasharray: `0 ${donutCircumference}` }}
                        animate={{
                          strokeDasharray: `${distributableLength} ${charityLength}`,
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        transform="rotate(-90)"
                      />

                      <motion.circle
                        r={donutRadius}
                        fill="none"
                        stroke="url(#charityGrad)"
                        strokeWidth="24"
                        strokeLinecap="round"
                        strokeDasharray={`${charityLength} ${distributableLength}`}
                        initial={{ strokeDasharray: `0 ${donutCircumference}` }}
                        animate={{
                          strokeDasharray: `${charityLength} ${distributableLength}`,
                        }}
                        transition={{
                          duration: 1.2,
                          ease: "easeOut",
                          delay: 0.1,
                        }}
                        transform="rotate(-90)"
                      />

                      <text
                        x="0"
                        y="-6"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#fff"
                      >
                        Distributed
                      </text>
                      <text
                        x="0"
                        y="12"
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="700"
                        fill="#fff"
                      >
                        {Number(stats.total_prize_pool_eth * 0.9).toFixed(4)}{" "}
                        ETH
                      </text>
                    </g>
                  </svg>
                </motion.div>

                <div className="flex-1 md:pl-4 text-left">
                  <h4 className="text-lg font-semibold text-red-100 mb-1">
                    Distributable Prize Pool
                  </h4>
                  <p className="text-3xl font-extrabold text-white mb-1">
                    <AnimatedNumber
                      value={stats.total_prize_pool_eth * 0.9}
                      decimals={4}
                    />
                    <span className="text-red-300 ml-2">ETH</span>
                  </p>
                  <p className="text-sm text-red-300 mb-1">
                    (Total: {Number(stats.total_prize_pool_eth).toFixed(4)} ETH)
                  </p>
                  <p className="text-sm text-red-300">
                    Charity (10%):{" "}
                    <span className="text-white font-medium">
                      {(stats.total_prize_pool_eth * 0.1).toFixed(4)} ETH
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Betting History Summary */}
          {bettingHistory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="p-6 bg-red-900/6 rounded-2xl border border-red-700/25 backdrop-blur-sm"
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Target className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-100">
                  Your Betting Summary
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="text-center p-4 bg-red-900/6 rounded-xl border border-red-700/25"
                >
                  <p className="text-red-300 text-sm font-medium mb-2">
                    Total Bets
                  </p>
                  <p className="text-2xl font-bold text-yellow-400">
                    <AnimatedNumber value={bettingHistory.total_bets} />
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="text-center p-4 bg-red-900/6 rounded-xl border border-red-700/25"
                >
                  <p className="text-red-300 text-sm font-medium mb-2">
                    Total Invested
                  </p>
                  <p className="text-2xl font-bold text-white">
                    <AnimatedNumber
                      value={bettingHistory.total_invested_eth}
                      decimals={4}
                    />
                    <span className="text-red-300 ml-1 text-lg">ETH</span>
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="text-center p-4 bg-red-900/6 rounded-xl border border-red-700/25"
                >
                  <p className="text-red-300 text-sm font-medium mb-2">
                    Total Returned
                  </p>
                  <p className="text-2xl font-bold text-red-300">
                    <AnimatedNumber
                      value={bettingHistory.total_returned_eth}
                      decimals={4}
                    />
                    <span className="text-red-300 ml-1 text-lg">ETH</span>
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`text-center p-4 rounded-xl border ${
                    bettingHistory.net_profit_eth >= 0
                      ? "bg-red-900/6 border-green-500/20"
                      : "bg-red-900/6 border-red-500/30"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-2 ${
                      bettingHistory.net_profit_eth >= 0
                        ? "text-green-300"
                        : "text-red-300"
                    }`}
                  >
                    Net P/L
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      bettingHistory.net_profit_eth >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {bettingHistory.net_profit_eth >= 0 ? "+" : ""}
                    <AnimatedNumber
                      value={bettingHistory.net_profit_eth}
                      decimals={4}
                    />
                    <span
                      className={`ml-1 text-lg ${
                        bettingHistory.net_profit_eth >= 0
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      ETH
                    </span>
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Betting History Details */}
          {bettingHistory && bettingHistory.bets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Wallet className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-100">
                  Betting History
                </h3>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {bettingHistory.bets.map((bet, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 + index * 0.1, duration: 0.5 }}
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 rounded-xl border bg-red-900/6 transition-all duration-200 ${
                        bet.status === "Won"
                          ? "border-green-500/20"
                          : "border-red-500/30"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-full ${
                              bet.status === "Won"
                                ? "bg-green-500/20"
                                : "bg-red-500/20"
                            }`}
                          >
                            {bet.status === "Won" ? (
                              <TrendingUp className="w-5 h-5 text-green-400" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">
                              {bet.team_name}
                            </p>
                            <p className="text-sm text-gray-300">
                              Bet:{" "}
                              <span className="text-blue-400 font-semibold">
                                <AnimatedNumber
                                  value={bet.bet_amount_eth}
                                  decimals={4}
                                />{" "}
                                ETH
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-sm font-medium px-3 py-1 rounded-full ${
                              bet.status === "Won"
                                ? "bg-green-800/10 text-green-300"
                                : "bg-red-800/10 text-red-300"
                            }`}
                          >
                            {bet.status}
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-300">
                              Returned:{" "}
                              <span className="text-green-400 font-semibold">
                                <AnimatedNumber
                                  value={bet.returned_amount_eth}
                                  decimals={4}
                                />{" "}
                                ETH
                              </span>
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                bet.profit_loss_eth >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              P/L: {bet.profit_loss_eth >= 0 ? "+" : ""}
                              <AnimatedNumber
                                value={bet.profit_loss_eth}
                                decimals={4}
                              />{" "}
                              ETH
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Status Messages */}
          {historyLoading || contractLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="text-6xl mb-4"
              >
                🎰
              </motion.div>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-red-200 text-lg font-medium"
              >
                Loading betting history...
              </motion.p>
              <p className="text-red-300 text-sm mt-2">
                Fetching your data from the blockchain
              </p>
            </motion.div>
          ) : !hasWithdrawableBets ? (
            <p className="text-red-200">You have no funds to withdraw</p>
          ) : (
            userBets
              .filter((bet) => calculateWithdrawableAmount(bet) > 0)
              .map((bet) => {
                const withdrawableAmount = calculateWithdrawableAmount(bet);
                const isUserWinner = isWinner(bet.team_id);
                const teamName =
                  teams?.find((t) => t.id === bet.team_id)?.name ||
                  `Team ${bet.team_id}`;

                return (
                  <div
                    key={bet.team_id}
                    className="bg-red-900/30 p-4 rounded-lg border border-red-500/20"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-red-100 font-semibold flex items-center gap-2">
                          {teamName}
                          {isUserWinner && (
                            <span className="text-yellow-400 text-sm">
                              🏆 Winning Team
                            </span>
                          )}
                          {status?.status === 3 && (
                            <span className="text-blue-400 text-sm">
                              🔄 Full Refund
                            </span>
                          )}
                        </p>
                        <p className="text-red-200 text-sm">
                          Your Bet: {bet.amount_eth.toFixed(4)} ETH
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-400 font-bold text-lg">
                          Withdrawable: {withdrawableAmount.toFixed(4)} ETH
                        </p>
                        {status?.status === 2 && isUserWinner && (
                          <p className="text-green-400 text-xs">
                            Prize Multiplier:{" "}
                            {(withdrawableAmount / bet.amount_eth).toFixed(2)}x
                          </p>
                        )}
                      </div>
                    </div>

                    {status?.status === 2 && isUserWinner && (
                      <div className="text-xs text-red-300 mb-3 p-2 bg-red-900/50 rounded">
                        💰 Prize Calculation: (Your Bet ÷ Winner Team Total Bet)
                        × Distributable Prize Pool
                      </div>
                    )}

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={() => handleWithdraw(bet.team_id)}
                        disabled={isPending || withdrawingTeam === bet.team_id}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <motion.div
                          className="flex items-center justify-center gap-2"
                          animate={
                            withdrawingTeam === bet.team_id
                              ? { scale: [1, 1.1, 1] }
                              : {}
                          }
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          {withdrawingTeam === bet.team_id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4" />
                              {status?.status === 3
                                ? "Confirm Refund"
                                : "Withdraw Prize"}
                            </>
                          )}
                        </motion.div>
                      </Button>
                    </motion.div>
                  </div>
                );
              })
          )}

          {/* Status Messages */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center p-4 bg-green-900/30 border border-green-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center gap-2 text-green-400 font-semibold">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    ✨
                  </motion.div>
                  Withdrawal Successful!
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                  >
                    🎉
                  </motion.div>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center p-4 bg-red-900/30 border border-red-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center gap-2 text-red-400 font-semibold">
                  ❌ Withdrawal Failed: {error.message}
                </div>
              </motion.div>
            )}

            {isConfirming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center p-4 bg-yellow-900/30 border border-yellow-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center gap-2 text-yellow-400 font-semibold">
                  <motion.div
                    className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                  />
                  Confirming transaction...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* No Funds Message */}
          {hasWithdrawableBets === false &&
            bettingHistory &&
            bettingHistory.bets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-6 bg-gray-900/30 border border-gray-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">
                    You have no funds to withdraw
                  </span>
                </div>
              </motion.div>
            )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
