'use client';

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Result() {
  const router = useRouter();

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
          <CardTitle className="text-center text-green-300 text-glow">下注成功！</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="text-6xl">🎉</div>
          <p className="text-red-100">您的下注已确认并记录在区块链上。</p>
          <div className="space-y-2">
            <p className="text-sm text-red-200">交易哈希:</p>
            <p className="text-xs bg-red-900/50 p-2 rounded break-all text-red-100">0x1234...abcd</p>
            <a href="#" className="text-red-300 text-sm hover:text-red-200">在Etherscan查看</a>
          </div>
          <div className="space-y-2">
            <Button onClick={() => router.push('/dashboard')} className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white glow-hover border border-red-400/50">
              返回大厅
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full border-red-400/50 text-red-200 hover:bg-red-900/30">
              查看我的下注
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}