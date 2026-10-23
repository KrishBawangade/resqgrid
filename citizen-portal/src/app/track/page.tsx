import { Suspense } from 'react';
import RequestTrackerView from '@/components/tracker/RequestTrackerView';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Live Request Tracker — ResQGrid Citizen Portal',
  description: 'Real-time transparent emergency relief status and stock allocation tracker.',
};

export default function TrackPage() {
  return (
    <div className="pb-12">
      <Suspense
        fallback={
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Loading Live Status Tracker...</span>
          </div>
        }
      >
        <RequestTrackerView />
      </Suspense>
    </div>
  );
}
