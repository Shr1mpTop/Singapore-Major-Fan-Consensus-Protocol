import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5001/api';

export interface StatusData {
  status: number;
  status_text: string;
  total_prize_pool_wei: string;
  winning_team_id: number;
}

export interface TeamData {
  id: number;
  name: string;
  total_bet_wei: string;
  supporters: number;
}

export interface StatsData {
  total_unique_participants: number;
  total_bets: number;
  total_prize_pool_wei: string;
  total_prize_pool_eth: number;
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