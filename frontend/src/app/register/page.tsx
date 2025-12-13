'use client';

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Register() {
  const [email, setEmail] = useState('');
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const handleNext = () => {
    if (isConnected) {
      // Store email in localStorage for demo
      localStorage.setItem('userEmail', email);
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-red-gradient flex items-center justify-center px-4 relative">
      {/* 背景图片 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{
          backgroundImage: "url('/bg.png')",
        }}
      />
      <div className="absolute inset-0 bg-black-glass" />

      <Card className="w-full max-w-md glass-red glow border-red-400/30 relative z-10">
        <CardHeader>
          <CardTitle className="text-center text-red-300 text-glow">注册参与</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-red-200">邮箱地址 (Email)</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-red-900/50 border-red-400/50 text-white placeholder-red-300"
            />
          </div>
          <div className="text-center">
            <ConnectButton />
          </div>
          {isConnected && (
            <div className="text-center text-sm text-red-200">
              连接地址: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
          <Button
            onClick={handleNext}
            disabled={!isConnected}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-hover border border-red-400/50"
          >
            进入大厅
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}