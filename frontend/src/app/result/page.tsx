'use client';

'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Result() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-center text-green-400">下注成功！</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="text-6xl">🎉</div>
          <p className="text-slate-300">您的下注已确认并记录在区块链上。</p>
          <div className="space-y-2">
            <p className="text-sm text-slate-400">交易哈希:</p>
            <p className="text-xs bg-slate-700 p-2 rounded break-all">0x1234...abcd</p>
            <a href="#" className="text-blue-400 text-sm">在Etherscan查看</a>
          </div>
          <div className="space-y-2">
            <Button onClick={() => router.push('/dashboard')} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
              返回大厅
            </Button>
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              查看我的下注
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}