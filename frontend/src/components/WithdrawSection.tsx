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

interface UserBet {
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

  // Get user's betting records from contract
  const { data: userBetResults, isLoading } = useReadContracts({
    contracts: userBetCalls,
    query: {
      enabled: !!address && isConnected && userBetCalls.length > 0,
    },
  });

  // Process the results into user bets
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
      <Card className="glass-black p-6 rounded-2xl border-2 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-red-100">
            Withdraw Prize
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-200">Please connect your wallet first</p>
        </CardContent>
      </Card>
    );
  }

  if (!canWithdraw) {
    return (
      <Card className="glass-black p-6 rounded-2xl border-2 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-red-100">
            Withdraw Prize
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-200">
            Current game status: {status?.status_text || "Unknown"}
            <br />
            You can only withdraw prizes after the match ends
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-black p-6 rounded-2xl border-2 border-red-500/30">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-red-100">
          {status?.status === 3 ? "Full Refund" : "Withdraw Prize"}
        </CardTitle>
        {/* Prize pool total amount display */}
        {stats && (
          <div className="text-center mt-4">
            <p className="text-yellow-400 text-lg font-semibold">
              Total Prize Pool: {stats.total_prize_pool_eth.toFixed(4)} ETH
            </p>
            {status?.status === 2 && (
              <p className="text-green-400 text-sm">
                Distributable Prize:{" "}
                {(stats.total_prize_pool_eth * 0.9).toFixed(4)} ETH (10% charity
                deduction)
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-red-200">Loading...</p>
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
                      💰 Prize Calculation: (Your Bet ÷ Winner Team Total Bet) ×
                      Distributable Prize Pool
                    </div>
                  )}

                  <Button
                    onClick={() => handleWithdraw(bet.team_id)}
                    disabled={isPending || withdrawingTeam === bet.team_id}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
                    {withdrawingTeam === bet.team_id
                      ? "Processing..."
                      : status?.status === 3
                      ? "Confirm Refund"
                      : "Withdraw Prize"}
                  </Button>
                </div>
              );
            })
        )}

        {isSuccess && (
          <div className="text-green-400 font-semibold text-center">
            ✅ Withdrawal Successful!
          </div>
        )}

        {error && (
          <div className="text-red-400 font-semibold text-center">
            ❌ Withdrawal Failed: {error.message}
          </div>
        )}

        {isConfirming && (
          <div className="text-yellow-400 font-semibold text-center">
            ⏳ Confirming...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
