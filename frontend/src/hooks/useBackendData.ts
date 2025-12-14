import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5001/api';

export interface StatusData {
  status: number;
  status_text: string;
  total_prize_pool_wei: string;
  winning_team_id: number;
}

export interface TeamData {
  id: number;
  name: string;
  logo_url: string;
  prize_pool_eth: number;
  bets_count: number;
  is_winner: boolean;
}

export interface StatsData {
  total_unique_participants: number;
  total_bets: number;
  total_prize_pool_wei: string;
  total_prize_pool_eth: number;
  weapon_equivalents: { 
    name: string; 
    count: number; 
    img: string;
    price_usd: number;
    progress: number;
  }[];
}

export interface LeaderboardData {
  rank: number;
  address: string;
  total_bet_eth: number;
}

export function useStats() {
  return useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/stats`);
      return response.data;
    },
    refetchInterval: 5000,
  });
}

export function useStatus() {
  return useQuery<StatusData>({
    queryKey: ['status'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/status`);
      return response.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export function useTeams() {
  return useQuery<TeamData[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/teams`);
      return response.data;
    },
    refetchInterval: 5000,
  });
}

export function useLeaderboard() {
  return useQuery<LeaderboardData[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/leaderboard`);
      return response.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });
}

export interface EthPriceData {
  symbol: string;
  price: string;
}

export function useEthPrice() {
  return useQuery<EthPriceData>({
    queryKey: ['ethPrice'],
    queryFn: async () => {
      const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds for price data
  });
}