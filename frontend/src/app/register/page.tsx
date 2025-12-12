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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-center text-yellow-400">注册参与</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">邮箱地址 (Email)</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="bg-slate-700 border-slate-600"
            />
          </div>
          <div className="text-center">
            <ConnectButton />
          </div>
          {isConnected && (
            <div className="text-center text-sm text-slate-400">
              连接地址: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
          <Button
            onClick={handleNext}
            disabled={!isConnected}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            进入大厅
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}