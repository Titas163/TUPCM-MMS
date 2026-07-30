import React, { useState } from 'react';
import { Button } from './Button';
import { Trash2 } from 'lucide-react';

export function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setIsConfirming(false)} className="h-8 px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">No</Button>
        <Button variant="destructive" size="sm" onClick={() => { setIsConfirming(false); onConfirm(); }} className="h-8 px-2 bg-red-600 hover:bg-red-700 text-white">Yes</Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={() => setIsConfirming(true)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
