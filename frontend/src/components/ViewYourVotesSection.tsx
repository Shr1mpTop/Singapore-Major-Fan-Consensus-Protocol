"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useUserVotingHistory } from "@/hooks/useBackendData";
import Link from "next/link";
import { AnimatedNumber } from "./AnimatedNumber";

// Team name to logo mapping (can be removed if logos are provided by backend)
const TEAM_LOGOS: Record<string, string> = {
  Vitality: "/teams/vitality.webp",
  Tyloo: "/teams/tyloo.svg",
  G2: "/teams/g2esports.webp",
  FaZe: "/teams/FaZeClan.webp",
  Spirit: "/teams/spirit.webp",
  "Natus Vincere": "/teams/NatusVincere.svg",
  NaVi: "/teams/NatusVincere.svg",
  ENCE: "/teams/ence.svg",
  Heroic: "/teams/heroic.webp",
};

export function ViewYourVotesSection() {
  const { address, isConnected } = useAccount();
  const {
    data: votingHistory,
    isLoading,
    error,
  } = useUserVotingHistory(address);

  if (!isConnected) {
    return (
      <motion.section
        id="your-votes-section"
        className="py-24 px-4 relative z-10"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent"></div>
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: -50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <h2 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow tracking-wider mb-4">
              Your Fan Consensus
            </h2>
            <p className="text-xl text-red-200 max-w-2xl mx-auto">
              Connect your wallet to view your voting history and results.
            </p>
            <motion.div
              className="w-40 h-2 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full mt-6"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            ></motion.div>
          </motion.div>
          <div className="max-w-2xl mx-auto">
            <Card className="glass-red p-8 text-center border-red-500/20">
              <CardContent>
                <p className="text-red-300 text-lg">
                  Connect your wallet to join the championship rally and track
                  your journey!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      id="your-votes-section"
      className="py-24 px-4 relative z-10"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent"></div>

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h2 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow tracking-wider mb-4">
            Your Champion Journey
          </h2>
          <p className="text-xl text-red-200 max-w-2xl mx-auto">
            Track your support for the teams fighting for glory at Singapore
            Major
          </p>
          <motion.div
            className="w-40 h-2 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full mt-6"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
          ></motion.div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-40 w-full bg-red-900/30 rounded-lg" />
            <Skeleton className="h-40 w-full bg-red-900/30 rounded-lg" />
            <Skeleton className="h-40 w-full bg-red-900/30 rounded-lg" />
          </div>
        ) : error ? (
          <p className="text-center text-red-400">
            Error loading your voting history. Please try again later.
          </p>
        ) : votingHistory && votingHistory.total_votes > 0 ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <Card className="glass-red border-red-500/20 text-center">
                <CardHeader>
                  <CardTitle className="text-red-300">
                    💪 Total Support
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-yellow-400">
                    <AnimatedNumber
                      value={votingHistory.total_invested_eth}
                      decimals={4}
                    />{" "}
                    ETH
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-red border-red-500/20 text-center">
                <CardHeader>
                  <CardTitle className="text-red-300">
                    🎁 Rewards Earned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-green-400">
                    <AnimatedNumber
                      value={votingHistory.total_returned_eth}
                      decimals={4}
                    />{" "}
                    ETH
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-red border-red-500/20 text-center">
                <CardHeader>
                  <CardTitle className="text-red-300">
                    Champion's Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-4xl font-bold ${
                      votingHistory.total_profit_eth >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    <AnimatedNumber
                      value={votingHistory.total_profit_eth}
                      decimals={4}
                    />{" "}
                    ETH
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Votes List */}
            <Card className="glass-red border-red-500/20">
              <CardHeader>
                <CardTitle className="text-2xl text-red-200">
                  Your Team Support History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {votingHistory.votes.map((vote, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-red-950/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <Image
                          src={
                            TEAM_LOGOS[vote.team_name] || "/teams/default.svg"
                          }
                          alt={vote.team_name}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                        <div>
                          <p className="font-bold text-lg text-white">
                            {vote.team_name}
                          </p>
                          <p className="text-sm text-red-300">
                            Voted: {vote.amount_eth.toFixed(4)} ETH
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold text-lg ${
                            vote.status === "Won"
                              ? "text-green-400"
                              : vote.status === "Lost"
                              ? "text-red-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {vote.status}
                        </p>
                        {vote.status === "Won" && (
                          <p className="text-sm text-green-300">
                            + {vote.payout_eth.toFixed(4)} ETH
                          </p>
                        )}
                        {vote.status === "Refunded" && (
                          <p className="text-sm text-yellow-300">
                            + {vote.payout_eth.toFixed(4)} ETH
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {votingHistory.total_returned_eth > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
                className="mt-12 text-center"
              >
                <div className="glass-red p-8 rounded-2xl max-w-md mx-auto">
                  <h3 className="text-2xl font-bold text-red-100 mb-4">
                    Claim Your Winnings or Refunds
                  </h3>
                  <p className="text-red-300 mb-6">
                    Your funds are ready to be withdrawn.
                  </p>
                  <Link href="/withdraw">
                    <Button className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold px-8 py-3">
                      Go to Withdraw Page
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="max-w-2xl mx-auto">
            <Card className="glass-red p-8 text-center border-red-500/20">
              <CardContent>
                <p className="text-red-300 text-lg mb-4">
                  You haven't placed any votes yet.
                </p>
                <Button asChild>
                  <Link href="/#voting-section">Go to Voting</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </motion.section>
  );
}
