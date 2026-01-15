import { MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type GoogleMapDemoProps = {
  address: string
  method: string
  eta: string
  note?: string
}

const dummyStops = [
  { name: 'Warehouse', time: '12:05', status: 'Departed' },
  { name: 'Hub', time: '13:20', status: 'Arrived' },
  { name: 'Customer', time: 'ETA 15:00', status: 'Pending' },
]

export function GoogleMapDemo({ address, method, eta, note }: GoogleMapDemoProps) {
  return (
    <Card className="shadow-sm bg-gradient-to-br from-amber-50 via-card to-orange-50 border-amber-100">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Map & delivery window</CardTitle>
          <CardDescription>Visual reference of the shipping address.</CardDescription>
        </div>
        <Badge className="bg-amber-500 text-white hover:bg-amber-600">Live ETA</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-amber-100 bg-amber-100/60 p-4 flex items-start gap-3">
          <div className="h-16 w-16 rounded-lg bg-amber-200 flex items-center justify-center">
            <MapPin className="h-7 w-7 text-amber-700" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-900">{address}</p>
            <p className="text-amber-800">{method} • ETA: {eta}</p>
            <p className="text-amber-800">Driver contact shared after dispatch.</p>
            {note && <p className="text-amber-800">{note}</p>}
          </div>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
          <p className="text-[11px] uppercase text-amber-800 tracking-wide mb-2">Route preview</p>
          <div className="flex items-center gap-2 text-xs text-amber-900 flex-wrap">
            {dummyStops.map((stop, idx) => (
              <div key={stop.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-semibold">{stop.name}</span>
                <span className="text-amber-700">• {stop.time}</span>
                <span className="text-amber-600">({stop.status})</span>
                {idx < dummyStops.length - 1 && <div className="h-px w-6 bg-amber-200" aria-hidden />}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white/80 p-3">
          <div className="aspect-video w-full rounded-md bg-gradient-to-br from-amber-200/60 via-amber-100 to-orange-100 flex items-center justify-center text-amber-800 text-sm font-medium">
            Demo map placeholder
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
