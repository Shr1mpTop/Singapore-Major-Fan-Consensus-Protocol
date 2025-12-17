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

// 合约ABI - withdraw函数和userVotes函数
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
    name: "userVotes",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// 合约地址
const CONTRACT_ADDRESS: `0x${string}` = (process.env
  .NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xb5c4bea741cea63b2151d719b2cca12e80e6c7e8") as `0x${string}`;

interface VotingHistory {
  total_votes: number;
  total_invested_eth: number;
  total_returned_eth: number;
  total_profit_eth: number; // 后端返回的字段名
  win_rate?: number;
  votes: {
    team_id: number;
    team_name: string;
    amount_eth: number; // 后端字段
    payout_eth: number; // 后端字段
    status: string;
    timestamp: string | null;
  }[];
}

interface UserVote {
  team_id: number;
  amount_wei: string;
  amount_eth: number;
}

export function WithdrawSection() {
  const { address, isConnected } = useAccount();
  const { data: status } = useStatus();
  const { data: teams } = useTeams();
  const { data: stats } = useStats();
  const [withdrawingTeam, setWithdrawingTeam] = useState<number | null>(null);

  // Create an array to store contract calls for all teams
  const userVoteCalls = [];

  if (teams && address && isConnected) {
    // Properly handle the readonly array type
    const teamsData = Array.isArray(teams) ? [...teams] : [];

    for (const team of teamsData) {
      userVoteCalls.push({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "userVotes" as const,
        args: [address as `0x${string}`, BigInt(team.id)],
      });
    }
  }

  // Get user's voting history and profit/loss calculation
  const { data: votingHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["votingHistory", address],
    queryFn: async () => {
      if (!address) return null;

      // Use the voting_history endpoint which returns all the data we need
      const response = await axios.get(
        `${
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5001/api"
        }/voting_history/${address}`
      );

      return response.data;
    },
    enabled: !!address,
    refetchInterval: 5000,
  });

  // Get user's voting records from contract (for withdrawal)
  const { data: userVoteResults, isLoading: contractLoading } =
    useReadContracts({
      contracts: userVoteCalls,
      query: {
        enabled: !!address && isConnected && userVoteCalls.length > 0,
      },
    });

  // Process the results into user votes (for withdrawal)
  const userVotes: UserVote[] = [];

  if (userVoteResults && teams && address && isConnected) {
    const teamsData = Array.isArray(teams) ? [...teams] : [];

    for (let i = 0; i < teamsData.length; i++) {
      const team = teamsData[i];
      const voteAmount = userVoteResults[i]?.result || BigInt(0);

      if (voteAmount > 0) {
        userVotes.push({
          team_id: team.id,
          amount_wei: voteAmount.toString(),
          amount_eth: Number(voteAmount) / 1e18,
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

  // 使用后端返回的payout_eth作为可提现金额
  const calculateWithdrawableAmount = (vote: any) => {
    // 后端已经计算好了payout_eth
    return vote.payout_eth || 0;
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
  const hasWithdrawableVotes =
    votingHistory?.votes &&
    votingHistory.votes.some((vote) => calculateWithdrawableAmount(vote) > 0);

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
              Collect Rewards
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
                Connect your wallet to continue
              </p>
              <p className="text-red-300 text-sm mt-2">
                Connect your wallet to view your voting history and withdraw
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
              Rewards Distribution
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
                Current status: {status?.status_text || "Unknown"}
              </p>
              <p className="text-red-300 text-sm">
                Rewards unlock when champions are crowned
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
              Victory Vault
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

          {/* Voting History Summary */}
          {votingHistory && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="p-6 bg-red-900/6 rounded-2xl border border-red-700/25 backdrop-blur-sm"
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Target className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-100">
                  Your Voting Summary
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="text-center p-4 bg-red-900/6 rounded-xl border border-red-700/25"
                >
                  <p className="text-red-300 text-sm font-medium mb-2">
                    Total Votes
                  </p>
                  <p className="text-2xl font-bold text-yellow-400">
                    <AnimatedNumber value={votingHistory.total_votes} />
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.03 }}
                  className="text-center p-4 bg-red-900/6 rounded-xl border border-red-700/25"
                >
                  <p className="text-red-300 text-sm font-medium mb-2">
                    Total Staked
                  </p>
                  <p className="text-2xl font-bold text-white">
                    <AnimatedNumber
                      value={votingHistory.total_invested_eth}
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
                      value={votingHistory.total_returned_eth}
                      decimals={4}
                    />
                    <span className="text-red-300 ml-1 text-lg">ETH</span>
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`text-center p-4 rounded-xl border ${
                    votingHistory.net_profit_eth >= 0
                      ? "bg-red-900/6 border-green-500/20"
                      : "bg-red-900/6 border-red-500/30"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-2 ${
                      votingHistory.total_profit_eth >= 0
                        ? "text-green-300"
                        : "text-red-300"
                    }`}
                  >
                    Net P/L
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      votingHistory.total_profit_eth >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {votingHistory.total_profit_eth >= 0 ? "+" : ""}
                    <AnimatedNumber
                      value={votingHistory.total_profit_eth}
                      decimals={4}
                    />
                    <span
                      className={`ml-1 text-lg ${
                        votingHistory.total_profit_eth >= 0
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

          {/* Voting History Details */}
          {votingHistory && votingHistory.votes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-3 mb-6">
                <Wallet className="w-6 h-6 text-red-400" />
                <h3 className="text-xl font-bold text-red-100">
                  Voting History
                </h3>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {votingHistory.votes.map((vote, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 + index * 0.1, duration: 0.5 }}
                      whileHover={{ scale: 1.02 }}
                      className={`p-4 rounded-xl border bg-red-900/6 transition-all duration-200 ${
                        vote.status === "Won"
                          ? "border-green-500/20"
                          : "border-red-500/30"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-full ${
                              vote.status === "Won"
                                ? "bg-green-500/20"
                                : "bg-red-500/20"
                            }`}
                          >
                            {vote.status === "Won" ? (
                              <TrendingUp className="w-5 h-5 text-green-400" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">
                              {vote.team_name}
                            </p>
                            <p className="text-sm text-gray-300">
                              Staked:{" "}
                              <span className="text-blue-400 font-semibold">
                                <AnimatedNumber
                                  value={vote.amount_eth}
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
                              vote.status === "Won"
                                ? "bg-green-800/10 text-green-300"
                                : "bg-red-800/10 text-red-300"
                            }`}
                          >
                            {vote.status}
                          </div>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-gray-300">
                              Returned:{" "}
                              <span className="text-green-400 font-semibold">
                                <AnimatedNumber
                                  value={vote.payout_eth}
                                  decimals={4}
                                />{" "}
                                ETH
                              </span>
                            </p>
                            <p
                              className={`text-sm font-semibold ${
                                vote.payout_eth - vote.amount_eth >= 0
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              P/L:{" "}
                              {vote.payout_eth - vote.amount_eth >= 0
                                ? "+"
                                : ""}
                              <AnimatedNumber
                                value={vote.payout_eth - vote.amount_eth}
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
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="text-6xl mb-4"
              >
                🎰
              </motion.div>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-red-200 text-lg font-medium"
              >
                Gathering your support records...
              </motion.p>
              <motion.p
                className="text-red-300 text-sm mt-2"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              >
                Syncing with the blockchain
              </motion.p>
            </motion.div>
          ) : !hasWithdrawableVotes ? (
            <p className="text-red-200">
              No rewards available for collection yet
            </p>
          ) : (
            votingHistory?.votes
              ?.filter((vote) => calculateWithdrawableAmount(vote) > 0)
              .map((vote) => {
                const withdrawableAmount = calculateWithdrawableAmount(vote);
                const isUserWinner = isWinner(vote.team_id);
                const teamName = vote.team_name || `Team ${vote.team_id}`;

                return (
                  <div
                    key={vote.team_id}
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
                          Your Vote: {vote.amount_eth.toFixed(4)} ETH
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-400 font-bold text-lg">
                          Withdrawable: {withdrawableAmount.toFixed(4)} ETH
                        </p>
                        {status?.status === 2 && isUserWinner && (
                          <p className="text-green-400 text-xs">
                            Prize Multiplier:{" "}
                            {(withdrawableAmount / vote.amount_eth).toFixed(2)}x
                          </p>
                        )}
                      </div>
                    </div>

                    {status?.status === 2 && isUserWinner && (
                      <div className="text-xs text-red-300 mb-3 p-2 bg-red-900/50 rounded">
                        💰 Prize Calculation: (Your Vote ÷ Winner Team Total
                        Votes) × Distributable Prize Pool
                      </div>
                    )}

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={() => handleWithdraw(vote.team_id)}
                        disabled={isPending || withdrawingTeam === vote.team_id}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <motion.div
                          className="flex items-center justify-center gap-2"
                          animate={
                            withdrawingTeam === vote.team_id
                              ? { scale: [1, 1.1, 1] }
                              : {}
                          }
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          {withdrawingTeam === vote.team_id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4" />
                              {status?.status === 3
                                ? "Collect Refund"
                                : "Claim Victory Reward"}
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
          {hasWithdrawableVotes === false &&
            votingHistory &&
            votingHistory.votes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-6 bg-gray-900/30 border border-gray-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">
                    No rewards available for collection yet
                  </span>
                </div>
              </motion.div>
            )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
