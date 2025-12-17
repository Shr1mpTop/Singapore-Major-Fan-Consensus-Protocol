"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { WithdrawSection } from "@/components/WithdrawSection";
import { useStatus } from "@/hooks/useBackendData";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function WithdrawPage() {
  const { isConnected } = useAccount();
  const { data: status, isLoading: statusLoading } = useStatus();

  // Redirect if contest is still active
  useEffect(() => {
    if (!statusLoading && status && status.status === 1) {
      // Contest is still active, redirect to home
      window.location.href = "/";
    }
  }, [status, statusLoading]);

  if (statusLoading) {
    return (
      <div className="min-h-screen bg-red-gradient text-white relative overflow-x-hidden flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-t-red-400 border-red-800 rounded-full"
        />
      </div>
    );
  }

  if (!status || status.status === 1) {
    return (
      <div className="min-h-screen bg-red-gradient text-white relative overflow-x-hidden flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-100 mb-4">
            Contest Still Active
          </h1>
          <p className="text-red-300 mb-8">
            The contest is still running. Please wait for it to end before
            withdrawing.
          </p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-gradient text-white relative overflow-x-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: "url('/bg.png')",
        }}
      />

      {/* Background Decorations */}
      <div className="fixed inset-0 bg-black-glass" />
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-red-900/40 to-transparent"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-500/6 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-red-500/3 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Fixed Wallet Connection */}
      <motion.div
        className="fixed top-4 right-4 z-50"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 1 }}
      >
        <ConnectButton />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-red-400 via-red-300 to-yellow-400 bg-clip-text text-transparent text-glow tracking-wider mb-4">
              {status.status === 2 ? "Victory Celebration" : "Safe Return"}
            </h1>
            <p className="text-xl text-red-200 max-w-2xl mx-auto">
              {status.status === 2
                ? "Your champion prevailed! Collect your share of glory."
                : "All contributions returned safely to supporters."}
            </p>
            <motion.div
              className="w-40 h-2 bg-gradient-to-r from-red-500 to-yellow-500 mx-auto rounded-full mt-6"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            ></motion.div>
          </motion.div>

          {/* Wallet Connection Check */}
          {!isConnected ? (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="glass-red p-8 rounded-2xl max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-red-100 mb-4">
                  Connect Your Wallet
                </h2>
                <p className="text-red-300 mb-6">
                  Connect your wallet to{" "}
                  {status.status === 2
                    ? "collect your rewards"
                    : "receive your contribution back"}
                  .
                </p>
                <ConnectButton />
              </div>
            </motion.div>
          ) : (
            /* Withdraw Section */
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <WithdrawSection />
            </motion.div>
          )}

          {/* Navigation */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Link href="/">
              <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-3">
                ← Back to Home
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
